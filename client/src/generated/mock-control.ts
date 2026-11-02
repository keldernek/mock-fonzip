export interface paths {
    "/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reseed the world
         * @description Rebuilds every organisation's data from the seed, empties the webhook logs and restores each organisation's default plan. The clock and issued tokens are kept.
         */
        post: operations["reset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/clock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the mock clock */
        get: operations["getClock"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/clock/advance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Move the mock clock forward
         * @description Tokens expire an hour after they were issued on this clock, so advancing it by 3600 seconds expires every token issued until now.
         */
        post: operations["advanceClock"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orgs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the organisations and their plans */
        get: operations["listOrgs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orgs/{org}/plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set an organisation's plan
         * @description A lapsed plan answers every API call and token request of that organisation with 402.
         */
        put: operations["setOrgPlan"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/credentials": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the API keys, their scopes and the rate limit */
        get: operations["listCredentials"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the webhook notifications the mock sent */
        get: operations["listWebhookDeliveries"];
        put?: never;
        post?: never;
        /** Empty the webhook delivery log */
        delete: operations["clearWebhookDeliveries"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/sink": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Receive a webhook notification
         * @description A webhook receiver inside the mock. Point a webhook's URL here to see its notifications under `/webhooks/received`.
         */
        post: operations["receiveWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/received": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the notifications the sink received */
        get: operations["listReceivedWebhooks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/simulations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the simulations and their inputs */
        get: operations["listSimulations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/simulations/{domain}/{name}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Run a simulation
         * @description Makes something happen that the API cannot do, such as a donor paying on the public site, and fires the webhooks it would. Each simulation documents its own input in the listing and answers with its own result.
         */
        post: operations["runSimulation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @enum {string} */
        OrgSlug: "kelder" | "ornek";
        /** @enum {string} */
        Plan: "active" | "lapsed";
        /** @enum {string} */
        Scope: "read" | "write";
        /** @enum {string} */
        Domain: "foundation" | "people" | "giving" | "dues-events" | "campaigns-forms-ecards";
        Ok: {
            /** @enum {string} */
            result: "ok";
        };
        ControlError: {
            error: string;
        };
        Clock: {
            /** Format: date-time */
            now: string;
        };
        ResetResult: {
            /** @enum {string} */
            result: "ok";
            /** Format: date-time */
            now: string;
        };
        ClockAdvance: {
            /** @description Seconds to add to the clock. */
            seconds: number;
        };
        Org: {
            slug: components["schemas"]["OrgSlug"];
            name: string;
            plan: components["schemas"]["Plan"];
        };
        OrgList: {
            orgs: components["schemas"]["Org"][];
        };
        PlanChange: {
            plan: components["schemas"]["Plan"];
        };
        OrgPlan: {
            slug: components["schemas"]["OrgSlug"];
            plan: components["schemas"]["Plan"];
        };
        Credential: {
            org: components["schemas"]["OrgSlug"];
            label: string;
            client_id: string;
            client_secret: string;
            scopes: components["schemas"]["Scope"][];
            plan: components["schemas"]["Plan"];
        };
        RateLimit: {
            /** @description Calls each API key may make to one operation per window. */
            limit: number;
            windowMs: number;
        };
        CredentialList: {
            /** @description The token endpoint's path on the mock's origin. */
            token_url: string;
            keys: components["schemas"]["Credential"][];
            rate_limit: components["schemas"]["RateLimit"];
        };
        /** @description The body Fonzip posts to a webhook. */
        WebhookNotification: {
            id: number;
            webhook_id: number;
            /** @enum {integer} */
            operation: 1 | 2 | 3 | 4 | 5 | 6;
            /** @enum {integer} */
            status: 0 | 3 | 4 | 5;
        };
        OutcomePending: {
            /** @enum {string} */
            state: "pending";
        };
        OutcomeDelivered: {
            /** @enum {string} */
            state: "delivered";
            /** @description The receiver's HTTP status. */
            status: number;
        };
        OutcomeFailed: {
            /** @enum {string} */
            state: "failed";
            error: string;
        };
        DeliveryOutcome: components["schemas"]["OutcomePending"] | components["schemas"]["OutcomeDelivered"] | components["schemas"]["OutcomeFailed"];
        WebhookDelivery: {
            id: number;
            /** Format: date-time */
            at: string;
            org: components["schemas"]["OrgSlug"];
            url: string;
            headers: {
                "content-type": string;
                "X-FZ-Auth-Token"?: string;
            };
            body: components["schemas"]["WebhookNotification"];
            outcome: components["schemas"]["DeliveryOutcome"];
        };
        WebhookDeliveryList: {
            deliveries: components["schemas"]["WebhookDelivery"][];
        };
        ReceivedNotification: {
            /** Format: date-time */
            at: string;
            receiver: string | null;
            auth_token: string | null;
            /** @description The JSON the sink received, or its raw text when it was not JSON. */
            body: unknown;
        };
        ReceivedNotificationList: {
            received: components["schemas"]["ReceivedNotification"][];
        };
        Simulation: {
            domain: components["schemas"]["Domain"];
            name: string;
            /** @description The simulation's path on the mock's origin. */
            path: string;
            description: string;
            /** @description Each input field the simulation reads, with a description of its value. */
            input: {
                [key: string]: string;
            };
        };
        SimulationList: {
            simulations: components["schemas"]["Simulation"][];
        };
        SimulationInput: {
            [key: string]: unknown;
        };
        SimulationResult: {
            [key: string]: unknown;
        };
    };
    responses: {
        /** @description The world was reseeded */
        ResetResult: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ResetResult"];
            };
        };
        /** @description The mock clock */
        Clock: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Clock"];
            };
        };
        /** @description The organisations */
        OrgList: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["OrgList"];
            };
        };
        /** @description The organisation's new plan */
        OrgPlan: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["OrgPlan"];
            };
        };
        /** @description The API keys */
        CredentialList: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["CredentialList"];
            };
        };
        /** @description Every webhook notification sent since the last reset or clear, oldest first */
        WebhookDeliveryList: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["WebhookDeliveryList"];
            };
        };
        /** @description Every notification the sink received since the last reset, oldest first */
        ReceivedNotificationList: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReceivedNotificationList"];
            };
        };
        /** @description The simulations */
        SimulationList: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["SimulationList"];
            };
        };
        /** @description What the simulation did */
        SimulationResult: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["SimulationResult"];
            };
        };
        /** @description Done */
        Ok: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Ok"];
            };
        };
        /** @description The request was refused */
        ControlError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ControlError"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type OrgSlug = components['schemas']['OrgSlug'];
export type Plan = components['schemas']['Plan'];
export type Scope = components['schemas']['Scope'];
export type Domain = components['schemas']['Domain'];
export type Ok = components['schemas']['Ok'];
export type ControlError = components['schemas']['ControlError'];
export type Clock = components['schemas']['Clock'];
export type ResetResult = components['schemas']['ResetResult'];
export type ClockAdvance = components['schemas']['ClockAdvance'];
export type Org = components['schemas']['Org'];
export type OrgList = components['schemas']['OrgList'];
export type PlanChange = components['schemas']['PlanChange'];
export type OrgPlan = components['schemas']['OrgPlan'];
export type Credential = components['schemas']['Credential'];
export type RateLimit = components['schemas']['RateLimit'];
export type CredentialList = components['schemas']['CredentialList'];
export type WebhookNotification = components['schemas']['WebhookNotification'];
export type OutcomePending = components['schemas']['OutcomePending'];
export type OutcomeDelivered = components['schemas']['OutcomeDelivered'];
export type OutcomeFailed = components['schemas']['OutcomeFailed'];
export type DeliveryOutcome = components['schemas']['DeliveryOutcome'];
export type WebhookDelivery = components['schemas']['WebhookDelivery'];
export type WebhookDeliveryList = components['schemas']['WebhookDeliveryList'];
export type ReceivedNotification = components['schemas']['ReceivedNotification'];
export type ReceivedNotificationList = components['schemas']['ReceivedNotificationList'];
export type Simulation = components['schemas']['Simulation'];
export type SimulationList = components['schemas']['SimulationList'];
export type SimulationInput = components['schemas']['SimulationInput'];
export type SimulationResult = components['schemas']['SimulationResult'];
export type ResponseResetResult = components['responses']['ResetResult'];
export type ResponseClock = components['responses']['Clock'];
export type ResponseOrgList = components['responses']['OrgList'];
export type ResponseOrgPlan = components['responses']['OrgPlan'];
export type ResponseCredentialList = components['responses']['CredentialList'];
export type ResponseWebhookDeliveryList = components['responses']['WebhookDeliveryList'];
export type ResponseReceivedNotificationList = components['responses']['ReceivedNotificationList'];
export type ResponseSimulationList = components['responses']['SimulationList'];
export type ResponseSimulationResult = components['responses']['SimulationResult'];
export type ResponseOk = components['responses']['Ok'];
export type ResponseControlError = components['responses']['ControlError'];
export type $defs = Record<string, never>;
export interface operations {
    reset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["ResetResult"];
        };
    };
    getClock: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Clock"];
        };
    };
    advanceClock: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClockAdvance"];
            };
        };
        responses: {
            200: components["responses"]["Clock"];
            400: components["responses"]["ControlError"];
        };
    };
    listOrgs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["OrgList"];
        };
    };
    setOrgPlan: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                org: components["schemas"]["OrgSlug"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlanChange"];
            };
        };
        responses: {
            200: components["responses"]["OrgPlan"];
            400: components["responses"]["ControlError"];
            404: components["responses"]["ControlError"];
        };
    };
    listCredentials: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["CredentialList"];
        };
    };
    listWebhookDeliveries: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["WebhookDeliveryList"];
        };
    };
    clearWebhookDeliveries: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
        };
    };
    receiveWebhook: {
        parameters: {
            query?: {
                /** @description Labels the notification, so one sink can stand in for several receivers. */
                receiver?: string;
            };
            header?: {
                /** @description The webhook's token, sent when its authentication is on. */
                "X-FZ-Auth-Token"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": unknown;
                "text/plain": string;
            };
        };
        responses: {
            200: components["responses"]["Ok"];
        };
    };
    listReceivedWebhooks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["ReceivedNotificationList"];
        };
    };
    listSimulations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["SimulationList"];
        };
    };
    runSimulation: {
        parameters: {
            query?: {
                org?: components["schemas"]["OrgSlug"];
            };
            header?: never;
            path: {
                domain: components["schemas"]["Domain"];
                name: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["SimulationInput"];
            };
        };
        responses: {
            200: components["responses"]["SimulationResult"];
            400: components["responses"]["ControlError"];
            404: components["responses"]["ControlError"];
            409: components["responses"]["ControlError"];
        };
    };
}
