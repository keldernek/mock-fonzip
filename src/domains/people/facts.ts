import type { Clock } from "../../core/clock";
import type { Row } from "../../store/collection";
import type {
  CardInfoRecord,
  CommunicationPermissionRecord,
  ContactProfileRecord,
  ContactRelationRecord,
  DonationRecord,
  EcardTransactionRecord,
  FormAnswerRecord,
  FundraisingCampaignRecord,
  FundraisingTeamRecord,
  MonthlyDonationRequestRecord,
  SubscriptionRecord,
  TicketSaleRecord,
  TimelineRecord,
  BankTransactionRecord,
  TransactionRecord,
  UserRecord,
} from "../../store/records";
import type { OrgStore } from "../../store/store";
import { dayOfInstant, type Day } from "./calendar";

function groupBy<T>(
  rows: readonly T[],
  key: (row: T) => number | null,
): ReadonlyMap<number, readonly T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const id = key(row);
    if (id === null) continue;
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

function lazy<T>(build: () => T): () => T {
  let value: { readonly built: T } | undefined;
  return () => {
    value ??= { built: build() };
    return value.built;
  };
}

const NONE: readonly never[] = [];

export interface Facts {
  readonly store: OrgStore;
  readonly today: Day;
  readonly now: Date;
  transaction(id: number | null): Row<TransactionRecord> | undefined;
  succeeded(transactionId: number | null): boolean;
  donations(userId: number): readonly Row<DonationRecord>[];
  microDonations(userId: number): readonly Row<DonationRecord>[];
  donationsToCampaign(campaignId: number): readonly Row<DonationRecord>[];
  subscriptions(userId: number): readonly Row<SubscriptionRecord>[];
  ticketSales(userId: number): readonly Row<TicketSaleRecord>[];
  formAnswers(userId: number): readonly Row<FormAnswerRecord>[];
  ecardSales(userId: number): readonly Row<EcardTransactionRecord>[];
  campaigns(userId: number): readonly Row<FundraisingCampaignRecord>[];
  teams(userId: number): readonly Row<FundraisingTeamRecord>[];
  cards(userId: number): readonly Row<CardInfoRecord>[];
  donationRequests(
    userId: number,
  ): readonly Row<MonthlyDonationRequestRecord>[];
  tagIds(userId: number): readonly number[];
  storedTimeline(userId: number): readonly Row<TimelineRecord>[];
  permission(userId: number): Row<CommunicationPermissionRecord> | undefined;
  profile(userId: number): Row<ContactProfileRecord> | undefined;
  relationsHeld(userId: number): readonly Row<ContactRelationRecord>[];
  relationsOf(userId: number): readonly Row<ContactRelationRecord>[];
  bankTransfers(userId: number): readonly Row<BankTransactionRecord>[];
  sharedValue(
    field: "email" | "phone" | "tckno" | "membership_no",
    user: Row<UserRecord>,
  ): boolean;
}

export function createFacts(store: OrgStore, clock: Clock): Facts {
  const now = clock.now();
  const byUser = <T extends { user_id: number | null }>(
    rows: () => readonly T[],
  ) => {
    const index = lazy(() => groupBy(rows(), (row) => row.user_id));
    return (userId: number): readonly T[] => index().get(userId) ?? NONE;
  };
  const donationsByCampaign = lazy(() =>
    groupBy(store.donations.list(), (row) => row.fundraising_campaign_id),
  );
  const tagIndex = lazy(() =>
    groupBy(store.userTags.list(), (row) => row.user_id),
  );
  const permissionIndex = lazy(
    () =>
      new Map(
        store.communicationPermissions
          .list()
          .flatMap((row) =>
            row.user_id === null ? [] : [[row.user_id, row] as const],
          ),
      ),
  );
  const profileIndex = lazy(
    () =>
      new Map(store.contactProfiles.list().map((row) => [row.user_id, row])),
  );
  const relatedIndex = lazy(() =>
    groupBy(store.contactRelations.list(), (row) => row.related_user_id),
  );
  const transferIndex = lazy(() =>
    groupBy(store.bankTransactions.list(), (row) => row.matched_user_id),
  );
  const valueCounts = lazy(() => {
    const counts = {
      email: new Map<string, number>(),
      phone: new Map<string, number>(),
      tckno: new Map<string, number>(),
      membership_no: new Map<string, number>(),
    };
    for (const user of store.users.list()) {
      for (const [field, map] of Object.entries(counts)) {
        const value = sharedKey(field, user);
        if (value !== null) map.set(value, (map.get(value) ?? 0) + 1);
      }
    }
    return counts;
  });
  const transaction = (id: number | null) =>
    id === null ? undefined : store.transactions.get(id);
  return {
    store,
    now,
    today: dayOfInstant(now),
    transaction,
    succeeded: (id) => transaction(id)?.payment_status === 3,
    donations: byUser(() => store.donations.list()),
    microDonations: byUser(() => store.microDonations.list()),
    donationsToCampaign: (id) => donationsByCampaign().get(id) ?? NONE,
    subscriptions: byUser(() => store.subscriptions.list()),
    ticketSales: byUser(() => store.ticketSales.list()),
    formAnswers: byUser(() => store.formAnswers.list()),
    ecardSales: byUser(() => store.ecardTransactions.list()),
    campaigns: byUser(() => store.fundraisingCampaigns.list()),
    teams: byUser(() => store.fundraisingTeams.list()),
    cards: byUser(() => store.cardInfos.list()),
    donationRequests: byUser(() => store.monthlyDonationRequests.list()),
    tagIds: (userId) =>
      (tagIndex().get(userId) ?? NONE).map((link) => link.tag_id),
    storedTimeline: byUser(() => store.timeline.list()),
    permission: (userId) => permissionIndex().get(userId),
    profile: (userId) => profileIndex().get(userId),
    relationsHeld: byUser(() => store.contactRelations.list()),
    relationsOf: (userId) => relatedIndex().get(userId) ?? NONE,
    bankTransfers: (userId) => transferIndex().get(userId) ?? NONE,
    sharedValue(field, user) {
      const key = sharedKey(field, user);
      return key !== null && (valueCounts()[field].get(key) ?? 0) > 1;
    },
  };
}

function sharedKey(field: string, user: Row<UserRecord>): string | null {
  switch (field) {
    case "email":
      return user.email === "" ? null : user.email.toLowerCase();
    case "phone": {
      const digits = user.phone.replaceAll(/\D/g, "");
      return digits === "" ? null : digits;
    }
    case "tckno":
      return user.tckno === "" ? null : user.tckno;
    case "membership_no":
      return user.membership_no === 0 ? null : String(user.membership_no);
    default:
      return null;
  }
}
