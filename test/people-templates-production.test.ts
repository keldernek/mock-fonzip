import { describe, expect, test } from "bun:test";

import {
  diffShapes,
  freeFormPropertyNames,
  shapeOf,
} from "../src/prod-parity/shape";
import { specIssues } from "../src/prod-parity/spec-issues";
import { routeOf } from "../src/testing/client";
import { client } from "./people-fixtures";

// Bodies rebuilt from what the redacted `parity:prod` report and probe show of
// production: the paths, the JSON kinds, and how often a row was null. The
// values are invented. The tests check that the corrected spec accepts these
// bodies and that the mock sends every path and kind in them.

const PAGE = { start_page: 1, how_many: 20 };
const PRODUCTION_DATE = "2026-03-04T05:06:07.123Z";

function productionRow(index: number) {
  const authored = index < 3;
  const updated = index < 2;
  return {
    id: 4000 + index,
    title: `Title ${index}`,
    // Null on 9 of 20 rows: the SMS templates.
    subject: index < 9 ? null : `Subject ${index}`,
    message: `Message ${index}`,
    type_sms: index < 9,
    // Null on 8 of 20 rows.
    category_id: index < 8 ? null : 4,
    category__name: index < 8 ? null : "Category",
    create_date: PRODUCTION_DATE,
    update_date: updated ? PRODUCTION_DATE : null,
    created_by_id: authored ? 7 : null,
    created_by__name: authored ? "Name" : null,
    updated_by_id: updated ? 7 : null,
    updated_by__name: updated ? "Name" : null,
  };
}

const PRODUCTION_LIST = {
  result: "ok",
  total: 20,
  template_list: Array.from({ length: 20 }, (_, index) => productionRow(index)),
};

function productionDetail(translations: Record<string, unknown>) {
  return {
    template: {
      id: 4000,
      title: "Title",
      subject: null,
      message: "Message",
      has_association_logo: false,
      type_sms: true,
      background_color: "#ffffff",
      body_color: "#000000",
      footer_text_color: "#111111",
      footer_icon_color: 2,
      has_button: false,
      btn_text: null,
      btn_color: "#222222",
      btn_text_color: "#333333",
      btn_operation: 2,
      btn_operation_detail: null,
      category_id: null,
      badge_icon: null,
      design: null,
      heading: null,
      preheader: null,
      references: {},
      translations,
    },
  };
}

const TR_WITH_TEXTS = {
  tr: { subject: "Konu", message: "Mesaj", btn_text: "Düğme" },
};
const TR_WITHOUT_TEXTS = {
  tr: { subject: null, message: null, btn_text: null },
};
// The probe's union over 20 templates: nine languages, strings everywhere
// except tr, which has nulls.
const ALL_LANGUAGES = Object.fromEntries(
  ["de", "en", "es", "fr", "it", "nl", "pt", "ru"]
    .map((language): [string, unknown] => [
      language,
      { subject: "s", message: "m", btn_text: "b" },
    ])
    .concat([["tr", { subject: null, message: "m", btn_text: null }]]),
);

describe("the corrected spec accepts what production sent", () => {
  const list = routeOf("listTemplates");
  const details = routeOf("getTemplateDetails");

  test("the list, with its result, its dates, its authors and its nulls", () => {
    expect(specIssues(list, 200, PRODUCTION_LIST)).toEqual([]);
  });

  test("the details, with the null fields, the empty references and any translations", () => {
    for (const translations of [
      TR_WITH_TEXTS,
      TR_WITHOUT_TEXTS,
      ALL_LANGUAGES,
      {},
    ]) {
      expect(
        specIssues(details, 200, productionDetail(translations)),
        JSON.stringify(Object.keys(translations)),
      ).toEqual([]);
    }
  });

  test("a button action may be a keyword, a URL or null", () => {
    for (const action of ["donation", "https://kelder.example/x", null]) {
      const body = productionDetail(TR_WITH_TEXTS);
      expect(
        specIssues(details, 200, {
          template: { ...body.template, btn_operation_detail: action },
        }),
        String(action),
      ).toEqual([]);
    }
  });

  test("design may be an object or a string as well as null", () => {
    for (const design of [{ blocks: [] }, "<p>x</p>", null]) {
      const body = productionDetail(TR_WITH_TEXTS);
      expect(
        specIssues(details, 200, { template: { ...body.template, design } }),
      ).toEqual([]);
    }
  });

  test("it still refuses what production never sent", () => {
    const body = productionDetail(TR_WITH_TEXTS);
    expect(
      specIssues(details, 200, {
        template: { ...body.template, category__name: "Genel" },
      }),
      "the detail has no category name",
    ).toEqual([
      "template.category__name: undocumented property (prod sent string)",
    ]);
    expect(
      specIssues(details, 200, {
        template: { ...body.template, invented: 1 },
      }),
    ).toEqual(["template.invented: undocumented property (prod sent integer)"]);
    expect(
      specIssues(details, 200, {
        template: { ...body.template, design: 5 },
      }),
    ).not.toEqual([]);
    expect(
      specIssues(details, 200, {
        template: { ...body.template, translations: { tr: { subject: 5 } } },
      }),
      "a translated text is a string or null",
    ).not.toEqual([]);
    expect(
      specIssues(details, 200, {
        template: { ...body.template, translations: { tr: "Konu" } },
      }),
      "a language maps to an object",
    ).not.toEqual([]);
    expect(
      specIssues(list, 200, {
        ...PRODUCTION_LIST,
        template_list: [{ ...productionRow(0), create_date: "yesterday" }],
      }),
      "create_date is a date-time",
    ).not.toEqual([]);
  });
});

describe("the mock sends every path and kind production sent", () => {
  test("in the list", async () => {
    const shared = client();
    const mock = await shared.ok("listTemplates", { query: PAGE });
    const diff = diffShapes(shapeOf(PRODUCTION_LIST), shapeOf(mock));
    expect(diff.prodOnly, "paths only production sends").toEqual([]);
    expect(diff.prodKinds, "kinds only production sends").toEqual([]);
  });

  test("in the details of the first row of the list", async () => {
    const shared = client();
    const first = (await shared.ok("listTemplates", { query: PAGE }))
      .template_list?.[0];
    const mock = await shared.ok("getTemplateDetails", {
      path: { template_id: first?.id ?? 0 },
    });
    for (const translations of [TR_WITH_TEXTS, TR_WITHOUT_TEXTS]) {
      const diff = diffShapes(
        shapeOf(productionDetail(translations)),
        shapeOf(mock),
      );
      expect(diff.prodOnly, "paths only production sends").toEqual([]);
      expect(diff.prodKinds, "kinds only production sends").toEqual([]);
    }
  });

  test("the first row is null exactly where production's was", async () => {
    const shared = client();
    const first = (await shared.ok("listTemplates", { query: PAGE }))
      .template_list?.[0];
    const mock = await shared.ok("getTemplateDetails", {
      path: { template_id: first?.id ?? 0 },
    });
    const production = productionDetail(TR_WITH_TEXTS).template;
    for (const [name, value] of Object.entries(production)) {
      if (name === "translations") continue;
      const sent: unknown = Object.entries(mock.template ?? {}).find(
        ([key]) => key === name,
      )?.[1];
      expect(sent === null, `${name} is null in the mock`).toBe(value === null);
    }
  });
});

describe("how the report prints a template", () => {
  test("names translations, design and references as free-form", () => {
    const names = freeFormPropertyNames();
    for (const name of ["translations", "design", "references"]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  test("prints the language codes under translations as {*}", async () => {
    const shared = client();
    const mock = await shared.ok("getTemplateDetails", {
      path: { template_id: 301 },
    });
    const paths = [...shapeOf(mock).keys()].filter((path) =>
      path.startsWith("template.translations"),
    );
    expect(paths.sort()).toEqual([
      "template.translations",
      "template.translations.{*}",
      "template.translations.{*}.{*}",
    ]);
    expect(
      [...shapeOf(productionDetail(ALL_LANGUAGES)).keys()].filter((path) =>
        path.startsWith("template.translations"),
      ),
      "production's languages print the same way",
    ).toContain("template.translations.{*}.{*}");
  });
});
