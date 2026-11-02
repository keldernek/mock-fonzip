export interface paths {
    "/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get Access Token
         * @description Returns token for access.
         *
         *     With `client_credentials`, every request returns a new token, valid for an hour. A key keeps its five newest tokens valid and retires older ones, so a client that lost its token can simply ask for another.
         *
         *     A token obtained through `authorization_code` is valid only while the administrator who approved the application is still an administrator of the organisation. Once they are removed, the token's calls and its refresh are refused, and the organisation has to approve the application again.
         */
        post: operations["getAccessToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * OAuth2 Authorize (GET)
         * @description Returns the consent page for OAuth2 authorization.
         */
        get: operations["oauthAuthorizeGet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get My Info
         * @description Returns information about the authenticated association.
         */
        get: operations["getMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * List Users
         * @description List Users
         */
        post: operations["getUserList"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/timeline": {
        parameters: {
            query: {
                /** @description return total number of timeline events */
                require_total?: boolean;
                /** @description list only notes */
                notes_only?: boolean;
                /** @description filter by note tag if notes_only is true */
                tag_id?: number;
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users Timeline
         * @description List Users Timeline
         *
         *     A module's events and leads are listed only when the API key, and for an application authorized through OAuth the authorization too, can access that module: donations for donation events and leads, membership dues for dues payments, events for event attendance, forms for form submissions, e-card sales for e-card purchases and fundraising campaigns for campaign events. A key restricted to specific forms lists no form submissions. Notes and the contact's own events (joining, profile updates, communication permissions, relations) are always listed. `total` counts only the listed events and leads.
         */
        get: operations["getUsersTimeline"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/tags": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users Tags
         * @description List Users Tags
         */
        get: operations["getUsersTagsList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/tags/{tag_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
                tag_id: number;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Adds Tag to User
         * @description Adds Tag to User
         */
        post: operations["addTagToUser"];
        /**
         * Removes Tag from User
         * @description Remove Tag from User
         */
        delete: operations["removeTagFromUser"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/donations": {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users Donations
         * @description List Users Donations
         */
        get: operations["getUsersDonationList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/micro-donations": {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users Micro Donations
         * @description List Users Micro Donations
         */
        get: operations["getUsersMicroDonationList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/monthly-donations": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users Monthly Donations
         * @description List Users Monthly Donations
         */
        get: operations["getUsersMonthlyDonationList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/monthly-donations/{donation_id}/update-request": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
                donation_id: number;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Monthly Donation Update Request
         * @description Creates Monthly Donation Update Request
         */
        post: operations["createMonthlyDonationUpdateRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/monthly-donations/{donation_id}/cc-update": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
                donation_id: number;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send Card Update Request For Monthly Donation
         * @description Sends Card Update Request For Monthly Donation
         */
        post: operations["sendCardUpdateRequestForMonthlyDonation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/communication-permissions/{permission_type}": {
        parameters: {
            query: {
                days?: number;
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                permission_type: "email" | "sms" | "phone";
            };
            cookie?: never;
        };
        /**
         * Lists the communication permissions changed in the last X days
         * @description Lists the communication permissions changed in the last X days
         */
        get: operations["listChangedCommunicationPermissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/communication-permissions/{permission_type}/{permission_value}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                permission_type: "email" | "sms" | "phone";
                permission_value: string;
            };
            cookie?: never;
        };
        /**
         * Lists the communication permissions of permission value
         * @description Lists the communication permissions of permission value
         */
        get: operations["getCommunicationPermissions"];
        /**
         * Updates the communication permissions of permission value
         * @description Updates the communication permissions of permission value
         */
        put: operations["updateCommunicationPermissions"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/monthly-donations/{donation_id}/update-request": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Cancel Monthly Donation
         * @description Cancels Monthly Donation
         */
        put: operations["cancelMonthlyDonation"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Respond Monthly Donation Amount Change Request
         * @description Responds Monthly Donation Amount Change Request
         */
        patch: operations["respondMonthlyDonationAmountChangeRequest"];
        trace?: never;
    };
    "/monthly-donations/{monthly_donation_order_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                monthly_donation_order_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Change Monthly Donation Values
         * @description Changes Monthly Donation Values
         */
        post: operations["changeMonthlyDonationValues"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/subscriptions": {
        parameters: {
            query: {
                listing?: "a" | "p" | "d" | "r";
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users Membership Dues
         * @description List Users Membership Dues
         */
        get: operations["getUsersMembershipDueList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/tickets": {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users Bought Tickets
         * @description List Users Bought Tickets
         */
        get: operations["getUserBoughtTicketList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/form-answers": {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users Answers
         * @description List Users Answers
         */
        get: operations["getUserAnswerList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/ecard-transactions": {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * List Users E-Cards
         * @description List Users E-Cards
         */
        get: operations["getUserEcardTransactionList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}/login-link": {
        parameters: {
            query?: {
                redirection_type?: 3 | 4 | 5 | 10 | 12;
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * Generate Login Link For User
         * @description Generates a link that signs the user in to their member profile without a password. It can be used once, within 120 minutes. Whoever opens it is signed in as the user, so give it only to the user it was generated for.
         *
         *     Login links are for members only. For an administrator of the organisation, the account owner included, the request is refused with `403`: administrators sign in from the login page. A link generated for a member who has become an administrator by the time it is opened signs nobody in.
         */
        get: operations["generateLoginLinkForUser"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        /**
         * Get User Details
         * @description Get User Details
         */
        get: operations["getUserDetails"];
        /**
         * Update User
         * @description Update User
         */
        put: operations["updateUser"];
        post?: never;
        /**
         * Delete User
         * @description Delete User
         */
        delete: operations["deleteUser"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create User
         * @description Create User
         */
        post: operations["createUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user-defined-values": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List User Defined Values
         * @description List User Defined Values
         */
        get: operations["getUserDefinedValuesList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Tags
         * @description List Tags
         */
        get: operations["getTagsList"];
        put?: never;
        /**
         * Create Tag
         * @description Create Tag
         */
        post: operations["createTag"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tags/{tag_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tag_id: number;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Update Tag
         * @description Update Tag
         */
        put: operations["updateTag"];
        post?: never;
        /**
         * Delete Tag
         * @description Delete Tag
         */
        delete: operations["deleteTag"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Donations
         * @description List Donations
         */
        get: operations["getDonationList"];
        put?: never;
        /**
         * Create Donation
         * @description Creates Donation. Card payment method is not allowed in API
         */
        post: operations["createDonation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations/report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Donation Report
         * @description Get Donation Report
         */
        get: operations["getDonationReport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donation/{donation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Donation Details
         * @description Get Donation Details
         */
        get: operations["getDonationDetails"];
        put?: never;
        post?: never;
        /**
         * Delete Donation
         * @description Delete Donation
         */
        delete: operations["deleteDonation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations/micro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Micro Donations
         * @description List Micro Donations
         */
        get: operations["getMicroDonationList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donation/micro/{donation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Micro Donation Details
         * @description Get Micro Donation Details
         */
        get: operations["getMicroDonationDetails"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donation-pages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Donation Pages
         * @description List Donation Pages
         */
        get: operations["getDonationPageList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donation-forms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Donation Forms
         * @description List Donation Forms
         */
        get: operations["getDonationFormList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/subscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Membership Dues
         * @description List Membership Dues
         */
        get: operations["getMembershipDuesList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/subscription/{subscription_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                subscription_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Membership Due Details
         * @description Get Membership Due Details
         */
        get: operations["getMembershipDueDetails"];
        put?: never;
        post?: never;
        /**
         * Delete Membership Due
         * @description Delete Membership Due
         */
        delete: operations["deleteMembershipDue"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/debts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Membership Due Debts
         * @description List Membership Due Debts
         */
        get: operations["getMembershipDueDebtsList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/debt/{debt_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                debt_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Debt Details
         * @description Get Debt Details
         */
        get: operations["getDebtDetails"];
        /**
         * Update Debt
         * @description Update Debt. The request replaces the debt's editable fields: send them all, as
         *     `GET /debt/{debt_id}` returns them, `transaction` included (its `amount` is the debt
         *     amount). `debt_category_id` is the exception: left out, the category is kept.
         */
        put: operations["updateDebt"];
        post?: never;
        /**
         * Delete Debt
         * @description Delete Debt
         */
        delete: operations["deleteDebt"];
        options?: never;
        head?: never;
        /**
         * Update Debt Status
         * @description Update Debt Status
         */
        patch: operations["updateDebtStatus"];
        trace?: never;
    };
    "/debt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Debt
         * @description Create Debt, and with `add_payment` its payment.
         *
         *     The member, the payment method, the payment's amount and fields, the bank account and
         *     the mail template are checked before the debt is written, so a mistake there writes
         *     nothing. One case can only fail after it: `custom_amount: total_debt` when the member's
         *     balance already covers the new debt, so there is nothing to pay. The answer then
         *     carries the error and the `debt_id` of the debt that was written. The debt stays, so do
         *     not send the same request again: record the payment from the console, or delete the
         *     debt with `DELETE /debt/{debt_id}` and send the request again.
         */
        post: operations["createDebt"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/debt-categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Debt Categories
         * @description List the debt categories (Borç Kategorileri), by name, with how their debts stand.
         *     Deleted categories are not listed.
         */
        get: operations["getDebtCategoryList"];
        put?: never;
        /**
         * Create Debt Category
         * @description Create Debt Category. Requires the edit membership dues permission.
         */
        post: operations["createDebtCategory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/debt-categories/{category_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Debt Category Usage
         * @description What deleting the category would move: its debts by state and the add-debt
         *     automations that raise debts in it.
         */
        get: operations["getDebtCategoryUsage"];
        /**
         * Rename Debt Category
         * @description Rename Debt Category. Requires the edit membership dues permission. A name the
         *     organisation already uses (ignoring case) is refused.
         */
        put: operations["updateDebtCategory"];
        post?: never;
        /**
         * Delete Debt Category
         * @description Delete Debt Category. Requires the edit membership dues permission.
         *
         *     A category nothing uses is deleted at once. A category that debts or add-debt
         *     automations use needs `replacement_id`: they are moved there (or left without a
         *     category, for null), then the category is deleted. Without it the answer is 409 with
         *     the usage, and nothing changes.
         *
         *     The move runs within the request. If it fails part way, the category stays and some of
         *     its debts may have moved already: send the same request again to finish the move. It is
         *     refused with 409 while another move involving either category is not finished.
         */
        delete: operations["deleteDebtCategory"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donation-categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Donation Categories
         * @description List Donation Categories
         */
        get: operations["getDonationCategoryList"];
        put?: never;
        /**
         * Create Donation Category
         * @description Create Donation Category
         */
        post: operations["createDonationCategory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donation-categories/{category_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Update Donation Category
         * @description Update Donation Category
         */
        put: operations["updateDonationCategory"];
        post?: never;
        /**
         * Delete Donation Category
         * @description Delete Donation Category
         */
        delete: operations["deleteDonationCategory"];
        options?: never;
        head?: never;
        /**
         * Update Donation Category Status
         * @description Update Donation Category Status
         */
        patch: operations["updateDonationCategoryStatus"];
        trace?: never;
    };
    "/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Events
         * @description List Events
         */
        get: operations["getEventList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/event/{event_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Event Details
         * @description Get Event Details
         */
        get: operations["getEventDetails"];
        /**
         * Update Event
         * @description Updates Event. WARNING: You cannot use a ticket in multiple events.
         */
        put: operations["updateEvent"];
        post?: never;
        /**
         * Delete Event
         * @description Delete Event
         */
        delete: operations["deleteEvent"];
        options?: never;
        head?: never;
        /**
         * Update Event Status
         * @description Update Event Status
         */
        patch: operations["updateEventStatus"];
        trace?: never;
    };
    "/event": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Event
         * @description Creates Event. WARNING: You cannot use a ticket in multiple events.
         */
        post: operations["createEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ticket/{ticket_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Ticket Details
         * @description Get Ticket Details
         */
        get: operations["getTicketDetails"];
        /**
         * Update Ticket
         * @description Updates Ticket. WARNING: You cannot use a ticket in multiple events.
         */
        put: operations["updateTicket"];
        post?: never;
        /**
         * Delete Ticket
         * @description Delete Ticket
         */
        delete: operations["deleteTicket"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ticket": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Ticket
         * @description Creates Ticket. WARNING: You cannot use a ticket in multiple events.
         */
        post: operations["createTicket"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ticket-sales": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Ticket Sales
         * @description List Ticket Sales
         */
        get: operations["getTicketSaleList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ticket-sale/{ticket_sale_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_sale_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Ticket Sale Details
         * @description Get Ticket Sale Details
         */
        get: operations["getTicketSaleDetails"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fundraising-campaigns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Fundraising Campaigns
         * @description List Fundraising Campaigns
         */
        get: operations["getFundraisingCampaignList"];
        put?: never;
        /**
         * Create Fundraising Campaign
         * @description Create Fundraising Campaign
         */
        post: operations["createFundraisingCampaign"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fundraising-campaign/{campaign_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                campaign_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Fundraising Campaign Details
         * @description Get Fundraising Campaign Details
         */
        get: operations["getFundraisingCampaignDetails"];
        /**
         * Update Fundraising Campaign
         * @description Update Fundraising Campaign
         */
        put: operations["updateFundraisingCampaign"];
        post?: never;
        /**
         * Delete Fundraising Campaign
         * @description Delete Fundraising Campaign
         */
        delete: operations["deleteFundraisingCampaign"];
        options?: never;
        head?: never;
        /**
         * Update Fundraising Campaign Status
         * @description Update Fundraising Campaign Status
         */
        patch: operations["updateFundraisingCampaignStatus"];
        trace?: never;
    };
    "/fundraising-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Fundraising Events
         * @description List Fundraising Events
         */
        get: operations["getFundraisingEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fundraising-event/{event_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Update Fundraising Event
         * @description Update Fundraising Event
         */
        put: operations["updateFundraisingEvent"];
        post?: never;
        /**
         * Delete Fundraising Event
         * @description Delete Fundraising Event
         */
        delete: operations["deleteFundraisingEvent"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fundraising-event": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Fundraising Event
         * @description Create Fundraising Event
         */
        post: operations["createFundraisingEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fundraising-teams": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Fundraising Teams
         * @description List Fundraising Teams
         */
        get: operations["getFundraisingTeams"];
        put?: never;
        /**
         * Create Fundraising Team
         * @description Create Fundraising Team
         */
        post: operations["createFundraisingTeam"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fundraising-team/{team_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Fundraising Team Detail
         * @description Get Fundraising Team Detail
         */
        get: operations["getFundraisingTeamDetail"];
        /**
         * Update Fundraising Team
         * @description Update Fundraising Team
         */
        put: operations["updateFundraisingTeam"];
        post?: never;
        /**
         * Delete Fundraising Team
         * @description Delete Fundraising Team
         */
        delete: operations["deleteFundraisingTeam"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fundraising-team/{team_id}/campaigns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Fundraising Teams Campaigns
         * @description List Fundraising Teams Campaigns
         */
        get: operations["getFundraisingTeamsCampaigns"];
        put?: never;
        /**
         * Create Fundraising Team Campaign
         * @description Create Fundraising Team Campaign
         */
        post: operations["createFundraisingTeamCampaign"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fundraising-team/{team_id}/campaign/{campaign_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update Fundraising Team Campaign
         * @description Update Fundraising Team Campaign
         */
        put: operations["updateFundraisingTeamCampaign"];
        post?: never;
        /**
         * Delete Fundraising Team Campaign
         * @description Delete Fundraising Team Campaign
         */
        delete: operations["deleteFundraisingTeamCampaign"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/forms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Forms
         * @description List Forms
         */
        get: operations["getFormList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/form-answers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Form Answers
         * @description List Form Answers
         */
        get: operations["getFormAnswerList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/form/{form_id}/answer/{answer_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                form_id: number;
                answer_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Form Answer Details
         * @description Get Form Answer Details
         */
        get: operations["getFormAnswerDetails"];
        put?: never;
        /**
         * Respond to Form Answer.
         * @description Respond to Form Answer (Approve/Reject). To send email with the response, put its subject and message in the body, fetched from the template if you use one - a template id alone is refused with 400. Either response merges the answer's contact into a pending duplicate when one is registered, so the contact id you hold may afterwards point at a merged record. The answer must belong to the form in the path; an answer of another form is not found (404) and is left unchanged, as with GET
         */
        post: operations["respondFormAnswer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ecards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List E-Cards
         * @description List E-Cards
         */
        get: operations["getEcardList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ecards/{ecard_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ecard_id: number;
            };
            cookie?: never;
        };
        /**
         * Get E-Card Details
         * @description Get E-Card Details
         */
        get: operations["getEcardDetails"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ecard-categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List E-Card Categories
         * @description List E-Card Categories
         */
        get: operations["getEcardCategoryList"];
        put?: never;
        /**
         * Create E-Card Category
         * @description Create E-Card Category
         */
        post: operations["createEcardCategory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ecard-categories/{category_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Update E-Card Category
         * @description Update E-Card Category
         */
        put: operations["updateEcardCategory"];
        post?: never;
        /**
         * Delete E-Card Category
         * @description Delete E-Card Category
         */
        delete: operations["deleteEcardCategory"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ecard-transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List E-Card Transactions
         * @description Lists e-card (certificate) transactions.
         *
         *     `start_date` and `end_date` are **mandatory** - a request without a
         *     valid date range is rejected with HTTP 400. At least one query
         *     parameter must be sent.
         *
         *     The `status` parameter selects which set of transactions is returned,
         *     and determines which of the remaining parameters are applied:
         *
         *     | status | contains | date range applies to | parameters applied |
         *     | --- | --- | --- | --- |
         *     | `paid` (default) | successful transactions | `transaction__complete_date` | all parameters below |
         *     | `refund` | refunded transactions | `transaction__refund_date` | `query`, `start_date`, `end_date`, `order_by`, `start_page`, `how_many` only |
         *     | `failed` | failed transactions | `transaction__complete_date` | `query`, `start_date`, `end_date`, `order_by`, `start_page`, `how_many` only |
         *
         *     Every parameter marked *(paid only)* below is **silently ignored** when
         *     `status` is `refund` or `failed`; those two lists always return their
         *     own fixed field set (see `EcardTransaction` schema) and do not honour
         *     the `list` parameter.
         */
        get: operations["getEcardTransactionList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ecard-transactions/{sale_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sale_id: number;
            };
            cookie?: never;
        };
        /**
         * Get E-Card Transaction Details
         * @description Get E-Card Transaction Details
         */
        get: operations["getEcardTransactionDetails"];
        put?: never;
        post?: never;
        /**
         * Delete E-Card Transaction
         * @description Delete E-Card Transaction
         */
        delete: operations["deleteEcardTransaction"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payment-systems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Payment Systems
         * @description List Payment Systems
         */
        get: operations["getPaymentSystemsList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bank-accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Bank Accounts
         * @description List Bank Accounts
         */
        get: operations["getBankAccountList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bank-accounts/{account_id}/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Bank account whose incoming transfers are listed */
                account_id: number;
            };
            cookie?: never;
        };
        /**
         * List Bank Account Transactions
         * @description List incoming wire transfers (EFT/FAST/havale) recorded against one of the
         *     association's bank accounts, newest first.
         *
         *     Each record carries the sender details as the bank reported them, plus its
         *     reconciliation state. A transfer is either still waiting to be matched
         *     (`payment_status` 8), already matched to a donation, dues payment or e-card sale
         *     (`payment_status` 3, with the corresponding `matched_*_id` set), or marked as one
         *     that will never be matched (`payment_status` 9).
         *
         *     Matching itself is performed in the Fonzip console and is not exposed by this API.
         *
         *     `start_date` and `end_date` are required and filter on `complete_date`.
         */
        get: operations["getBankAccountTransactionList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/marketing-channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Marketing Channels
         * @description List Marketing Channels captured for the association. Each record represents
         *     a unique combination of UTM parameters (`utm_source`, `utm_medium`,
         *     `utm_campaign`, `utm_content`) seen by donation or e-card checkout flows.
         *     Includes aggregate counts of successful donations and e-card sales per channel.
         */
        get: operations["getMarketingChannelList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/marketing-channels/filter-values": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Marketing Channel Filter Values
         * @description Returns the distinct values seen for each UTM field across the
         *     association's marketing channels. Useful for populating filter
         *     dropdowns when listing donations or e-card transactions by UTM dimension.
         */
        get: operations["getMarketingChannelFilterValues"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Templates
         * @description List Templates
         */
        get: operations["listTemplates"];
        put?: never;
        /**
         * Create Template
         * @description Create Template
         */
        post: operations["createTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/template/{template_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Template Details
         * @description Get Template Details
         */
        get: operations["getTemplateDetails"];
        /**
         * Update Template
         * @description Update Template
         */
        put: operations["updateTemplate"];
        post?: never;
        /**
         * Delete Template
         * @description Delete Template. A template that is still in use cannot be deleted, and the 409 response names the
         *     first use found: an active fundraising campaign, a donation page or form, an e-card, an automation, a
         *     3rd party application, or the fundraising, membership dues or recurring donation settings.
         */
        delete: operations["deleteTemplate"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Webhooks
         * @description List Webhooks
         */
        get: operations["listWebhooks"];
        put?: never;
        /**
         * Create Webhook
         * @description Create Webhook
         */
        post: operations["createWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhook/{webhook_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                webhook_id: number;
            };
            cookie?: never;
        };
        /**
         * Get Webhook Details
         * @description Get Webhook Details
         */
        get: operations["getWebhookDetails"];
        /**
         * Update Webhook
         * @description Update Webhook
         */
        put: operations["updateWebhook"];
        post?: never;
        /**
         * Delete Webhook
         * @description Delete Webhook
         */
        delete: operations["deleteWebhook"];
        options?: never;
        head?: never;
        /**
         * Send Webhook Test Notification
         * @description Send Webhook Test Notification
         */
        patch: operations["sendWebhookTestNotification"];
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        FundraisingTeamCampaignList: {
            /** @description Fundraising team campaign id */
            id?: number;
            /** @description Fundraising team campaign title */
            title?: string;
            /** @description Fundraising team campaign has target */
            has_target?: boolean;
            /**
             * Format: double
             * @description Fundraising team campaign target
             */
            target?: number;
            /** @description Fundraising team campaign target currency id */
            target_currency_id?: number;
            /** @description Fundraising team campaign target currency display */
            target_currency__display?: number;
            /** @description Fundraising team campaign is currently active & default */
            default?: boolean;
        };
        /**
         * @description payment type code
         *     - 0: Card
         *     - 1: Cash
         *     - 2: Wire Transfer
         *     - 3: POS
         *     - 4: SMS
         *     - 6: Postal Check
         *     - 7: Paypal
         *     - 8: BKM Express
         *     - 9: iDEAL
         *     - 10: Pay With Iyzico
         * @enum {integer}
         */
        PaymentMethod: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
        /**
         * @description error group of a failed payment, as Fonzip classifies its error (returned with `status=failed`); null when the failure recorded no error
         *     - 10: insufficient limit
         *     - 20: lost or stolen card
         *     - 21: expired card
         *     - 22: card closed or not authorised
         *     - 30: card details rejected
         *     - 40: 3D Secure error
         *     - 41: suspected fraud
         *     - 50: bank or system error
         *     - 60: payment setup error
         *     - 61: integration error
         *     - 70: POS operation error
         *     - 99: unknown error, or one not classified yet
         */
        TransactionErrorGroup: number | null;
        Template: {
            /** @description Template id */
            id?: number;
            /** @description Template Title */
            title?: string;
            /** @description Subject */
            subject?: string;
            /** @description Template content */
            message?: string;
            /** @description True if mail includes the logo of association */
            has_association_logo?: boolean;
            /** @description True if template is for sms, False if template is for email */
            type_sms?: boolean;
            /** @description color in HEX format, such as */
            background_color?: string;
            /** @description text color in HEX format, such as */
            body_color?: string;
            /** @description footer color in HEX format, such as */
            footer_text_color?: string;
            /**
             * @description footer icon color. 0 for gray, 1 for light, 2 for dark (default)
             * @enum {integer}
             */
            footer_icon_color?: 0 | 1 | 2;
            /** @description whether a button is added or not */
            has_button?: boolean;
            /** @description button text */
            btn_text?: string;
            /** @description button color in HEX format, such as */
            btn_color?: string;
            /** @description button text in HEX format, such as */
            btn_text_color?: string;
            /**
             * @description button operation. 1 for URL, 2 for Fonzip Related operation
             * @enum {integer}
             */
            btn_operation?: 1 | 2;
            /** @description button action detail */
            btn_operation_detail?: ("login" | "cc" | "donation" | "dues" | "member_card") | string;
            /** @description Template category id */
            category_id?: number;
            /** @description Template category name */
            category__name?: string;
            /** @description translations of template */
            translations?: {
                language_code?: {
                    subject?: string;
                    message?: string;
                    btn_text?: string;
                };
            };
        };
        WebhookList: {
            /** @description Webhook Id */
            id?: number;
            /** @description Webhook Name */
            name?: string;
            /**
             * Format: uri
             * @description Webhook URL
             */
            url?: string;
        };
        TemplateList: {
            /** @description Template Id */
            id?: number;
            /** @description Template Name */
            title?: string;
            /** @description Subject */
            subject?: string;
            /** @description Template content */
            message?: string;
            /** @description Template category id */
            category_id?: number;
            /** @description Template category name */
            category__name?: string;
            /** @description True if template is for sms, False if template is for email */
            type_sms?: boolean;
        };
        WebhookNotification: {
            /** @description Object id */
            id?: number;
            /** @description Webhook ID */
            webhook_id?: number;
            /**
             * @description Operation Type
             *     - 1: Donation
             *     - 2: Subscription
             *     - 3: Ticket
             *     - 4: Form
             *     - 5: E-Card Transaction
             *     - 6: Fundraising Campaigns
             * @enum {integer}
             */
            operation?: 1 | 2 | 3 | 4 | 5 | 6;
            /**
             * @description Objects status. For fundraising campaign;
             *     - 0: campaign created
             *     For others
             *     - 3: successful
             *     - 4: refunded
             *     - 5: error
             */
            status?: number;
        };
        Currency: {
            /** @description currency id */
            id?: number;
            /** @description currency name */
            name?: string;
            /** @description currency short */
            short?: string;
            /** @description currency display */
            display?: string;
            /** @description currency code for iyzico */
            iyzi_code?: string;
            /** @description currency ISO code */
            iso_code?: string;
            /**
             * Format: double
             * @description currency value against TRY
             */
            value?: number;
            /**
             * Format: date-time
             * @description value last update date
             */
            last_update_date?: string;
        };
        UserSingleFieldUpdate: {
            /**
             * @description field to be updated
             * @enum {string}
             */
            field?: "first_name" | "last_name" | "nationality_text" | "tckno" | "birthday" | "email" | "phone" | "home_phone_first" | "address" | "post_code" | "district_text" | "city_text" | "country_text" | "work_phone" | "work_address" | "work_post_code" | "private" | "work_district_text" | "work_city_text" | "work_country_text" | "email_second" | "apply_date" | "join_date" | "corporate_type";
            value?: string | number | boolean;
        };
        UserMultipleFieldUpdate: components["schemas"]["UserSingleFieldUpdate"][];
        UserUdvFieldUpdate: {
            /** @description user defined value id */
            udv_id?: number;
            value?: string | number | boolean | Record<string, unknown> | unknown[];
        };
        UserMembershipNoUpdate: {
            /**
             * @description how to assign the new membership number
             *     - no: does not make any changes
             *     - auto: assigns the next available membership number incrementally
             *     - custom: sets your value
             * @enum {string}
             */
            membership_no_decision?: "no" | "auto" | "custom";
            /** @description custom membership number you'd like to set, valid when membership_no_decision is custom */
            membership_no?: number;
        };
        User: {
            /** @description User id */
            id?: number;
            /** @description true if user is set as corporate */
            corporate_type?: boolean;
            /** @description first name */
            first_name?: string;
            /** @description last name */
            last_name?: string;
            /** @description address */
            address?: string | null;
            /**
             * Format: date
             * @description birthday
             */
            birthday?: string | null;
            /** @description users current balance amount */
            total_financial?: number;
            /**
             * Format: email
             * @description email
             */
            email?: string;
            /** @description users tags represented a text */
            tags_as_text?: string;
            /** @description phone */
            phone?: string;
            /** @description users membership number */
            membership_no?: number;
            /** @description Users Identity Number */
            tckno?: string | null;
            /**
             * Format: date
             * @description users apply date
             */
            apply_date?: string;
            /**
             * Format: date
             * @description users join date
             */
            join_date?: string;
            /** @description user defined values as key value pairs */
            user_defined_values?: Record<string, unknown>;
            /** @description if user has communication permission via email */
            allow_comm_via_email?: boolean;
            /**
             * Format: date-time
             * @description email communication permission update date
             */
            allow_comm_via_email_date?: string;
            /** @description if user has communication permission via phone */
            allow_comm_via_phone?: boolean;
            /**
             * Format: date-time
             * @description phone communication permission update date
             */
            allow_comm_via_phone_date?: string | null;
            /** @description if user has communication permission via sms */
            allow_comm_via_sms?: boolean;
            /**
             * Format: date-time
             * @description sms communication permission update date
             */
            allow_comm_via_sms_date?: string | null;
            /** @description City */
            city_text?: string | null;
            /** @description Country */
            country_text?: string | null;
            /** @description District */
            district_text?: string | null;
            /** @description nationality */
            nationality_text?: string | null;
            /**
             * Format: date-time
             * @description last login date
             */
            last_login_date?: string | null;
            /**
             * Format: date-time
             * @description profile last update date
             */
            last_update_date?: string;
            /** @description profile picture URL */
            profile_pic?: string | null;
            /** @description Work address */
            work_address?: string | null;
            /** @description Work city */
            work_city_text?: string | null;
            /** @description Work country */
            work_country_text?: string | null;
            /** @description Work district */
            work_district_text?: string | null;
            /** @description Work phone */
            work_phone?: string | null;
        };
        AssociationInfo: {
            id?: number;
            name?: string;
            display_name?: string;
            display_name_translations?: Record<string, unknown>;
            details?: string;
            details_translations?: Record<string, unknown>;
            phone?: string | null;
            email?: string;
            url?: string;
            facebook_url?: string;
            twitter_url?: string;
            instagram_url?: string;
            linkedin_url?: string;
            locale?: string;
            footer_address?: string;
            footer_phone?: string;
            footer_email?: string;
            whatsapp_number?: string;
            youtube_url?: string;
            /** @example ok */
            result?: string;
        };
        UserSearch: {
            /**
             * @description start page
             * @default 1
             */
            start_page: number;
            /**
             * @description how many records should be listed
             * @default 10
             */
            how_many: number;
            /**
             * @description ordering
             * @default id
             * @enum {string}
             */
            order_by: "id" | "-id" | "name" | "-name" | "first_name" | "-first_name" | "last_name" | "-last_name" | "membership_no" | "-membership_no" | "email" | "-email" | "phone" | "-phone" | "tckno" | "-tckno" | "total_financial" | "-total_financial" | "-birthday" | "birthday" | "apply_date" | "-apply_date" | "join_date" | "-join_date" | "last_update_date" | "-last_update_date";
            filter: components["schemas"]["MainSearchFilter"];
        };
        /** @description filters */
        MainSearchFilter: {
            /** @enum {string} */
            condition: "and" | "or";
            attributes: (components["schemas"]["UserSearchFilters"] | components["schemas"]["MainSearchFilter"])[];
        };
        UserSearchFilters: {
            /**
             * @description Field type. Use default for system defined fields, Use custom for user defined fields
             * @default default
             * @enum {string}
             */
            type: "default" | "custom";
            /**
             * @description Parameter for search.
             *
             *     `debt_category` (an unpaid or paid debt), `unpaid_debt_category` and
             *     `paid_debt_category` take a debt category id, or `none` for a debt without a
             *     category, with the `eq`, `neq` or `exclude` condition. `eq` finds users with such a
             *     debt, `neq` users without one. A deleted category is accepted.
             * @enum {string}
             */
            parameter: "name" | "address" | "donation_amount" | "donation_count" | "donation_date" | "fundraising_campaign" | "sub_donation_type" | "donation_page" | "donor_type" | "fundraising_campaign_count" | "apply_date" | "total_financial" | "subscription_payment_date" | "subscription_payment_amount" | "birthdate" | "birthday" | "custom_form" | "recurring_debt" | "recurring_donor" | "total_recurring_withdrawal_count" | "total_recurring_withdrawal_amount" | "email" | "tags" | "registered_event_count" | "event_register_date" | "form_complete_date" | "district" | "allow_comm_via_phone" | "allow_comm_via_sms" | "allow_comm_via_email" | "registered_event" | "join_date" | "fundraising_campaign_start_date" | "fundraising_campaign_end_date" | "fundraising_campaign_donation_total" | "fundraising_campaign_donation_count" | "fundraising_campaign_total_donation_total" | "fundraising_campaign_total_donation_count" | "notes" | "registered_card" | "post_code" | "profile_pic" | "bought_certificate" | "certificate" | "certificate_count" | "certificate_date" | "admin" | "create_date" | "last_update_date" | "city" | "tckno" | "phone" | "total_donation_amount" | "nationality" | "country" | "membership_no" | "age" | "notify_after_dues_withdrawal" | "default_dues_reminder_withdrawal" | "card_add_date" | "dues_card_add_date" | "possible_duplicate" | "reminder_settings" | "automatic_dues_withdrawal" | "reminder_next_cycle" | "reminder_period" | "last_login_date" | "work_district" | "work_city" | "work_country" | "work_address" | "work_post_code" | "corporate_type" | "donation_currency" | "certificate_currency" | "recurring_donation_amount" | "total_recurring_donation_amount" | "total_recurring_donation_count" | "recurring_donation_start_date" | "recurring_donation_cancel_date" | "fundraising_campaign_status" | "fundraising_campaign_target" | "fundraising_campaign_donation_type" | "fundraising_campaign_target_event" | "fundraising_campaign_event_date" | "recurring_amount_change" | "recurring_amount_change_date" | "d_type" | "first_donation_date" | "first_monthly_donation_date" | "address_book" | "debt_record" | "unpaid_debt_record" | "paid_debt_record" | "debt_category" | "unpaid_debt_category" | "paid_debt_category" | "subscription_payment_method" | "ticket_payment_method" | "ecard_payment_method" | "donation_payment_method" | "blocked_mail" | "spam_mail" | "agreement" | "agreement_version" | "agreement_sign_date" | "language" | "fundraising_team" | "fundraising_event" | "fundraising_team_campaign" | "fundraising_team_member" | "fundraising_team_campaign_member" | "password" | "last_ip_address" | "days_since_registration" | "days_since_activation" | "active_membership_duration" | "membership_duration" | "failed_donation_amount" | "failed_donation_date" | "failed_fundraising_campaign" | "failed_sub_donation_type" | "failed_donation_page" | "failed_donation_currency" | "failed_fundraising_team" | "failed_fundraising_event" | "failed_fundraising_team_campaign" | "note_date" | "id" | "added_donation_count" | "added_donation_amount" | "added_total_donation_amount" | "added_monthly_donation_count" | "added_monthly_donation_amount" | "added_total_monthly_donation_amount" | "added_donation_date" | "f2f_group_id" | "allow_comm_via_phone_date" | "allow_comm_via_sms_date" | "allow_comm_via_email_date" | "card_count" | "card_expiry" | "card_for_dues" | "note_tag" | "card_type_for_dues" | "card_type" | "note_count" | "bought_ticket_type" | "history_event_type" | "history_event_date" | "history_event_note" | "history_event_active_days" | "donation_details" | "membership_due_details" | "first_name" | "last_name" | "unpaid_debt_count" | "recurring_limit" | "remaining_recurring_limit" | "is_related_contact" | "has_related_contact" | "related_contact_dues_perm" | "related_contact_comm_perm" | "related_contact_tag" | "related_contact_note" | "related_contact_of" | "cancel_request_date" | "cancel_request" | "work_phone" | "home_phone_first" | "note_added_by" | "debt_amount" | "total_debt_amount" | "ecard_amount" | "total_ecard_sum" | "ecard_category" | "ecard_delivery_date" | "ecard_recipient_count" | "total_ecard_recipient_count" | "ecard_has_cargo" | "donation_utm_source" | "donation_utm_medium" | "donation_utm_campaign" | "donation_utm_content" | "ecard_utm_source" | "ecard_utm_medium" | "ecard_utm_campaign" | "ecard_utm_content" | "saved_iban" | "saved_iban_number" | "saved_iban_bank" | "saved_iban_assignment_type" | "saved_iban_donation_category" | "saved_iban_donation_page" | "saved_iban_fundraising_campaign" | "saved_iban_donation_form" | "saved_iban_count" | "saved_iban_add_date" | "saved_iban_sender_name";
            value?: number | string | Record<string, unknown> | null;
            attributes?: components["schemas"]["MainSearchFilter"][];
            /**
             * @description Filtering condition
             *     - eq : equals to value
             *     - contains: contains value (split via ; for multiple records for id and membership_no)
             *     - exclude: value excluded
             *     - exist: parameters value exist
             *     - isnull: parameters value is null
             *     - duplicate: duplicate records for parameter (email, phone, tckno, membership_no)
             *     - lte: less than & equal to value
             *     - lt: less than value
             *     - gte: greated than & equal to value
             *     - gt: greated than value
             *     - neq: not equal to value (for numeric & dates)
             *     - or: or condition
             *     - and: and condition
             *     - !lt: not before
             *     - !gt: not after
             *     - =: (value) days ago
             *     - +=: (value) days after
             *     - <: less than (value) days
             *     - >: more than (value) days
             *     - (): range between numbers ({start:0,end:1})
             *     - .: today
             *     - +<: in next (value) days
             * @enum {string}
             */
            condition: "eq" | "contains" | "exclude" | "exist" | "isnull" | "duplicate" | "lte" | "lt" | "gte" | "gt" | "neq" | "or" | "and" | "!lt" | "!gt" | "=" | "+=" | "<" | ">" | "()" | ".";
            /**
             * @description User defined value type
             *     - 0: text
             *     - 1: paragraph
             *     - 2: number
             *     - 3:date
             *     - 4:year
             *     - 5: date-time
             *     - 6: boolean
             *     - 7: select
             *     - 8: multiple select
             * @enum {integer}
             */
            key_type?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
        };
        UserSearchValues: ("id" | "corporate_type" | "first_name" | "last_name" | "nationality_text" | "country_text" | "city_text" | "district_text" | "address" | "birthday" | "total_financial" | "work_address" | "work_phone" | "work_country_text" | "work_city_text" | "work_district_text" | "email" | "tags_as_text" | "last_update_date" | "last_login_date" | "phone" | "profile_pic" | "membership_no" | "tckno" | "apply_date" | "join_date" | "allow_comm_via_email" | "allow_comm_via_phone" | "allow_comm_via_sms" | "allow_comm_via_email_date" | "allow_comm_via_phone_date" | "allow_comm_via_sms_date") | string;
        Timeline: {
            /**
             * @description timeline event id <br>
             *     Acquisition-lead rows (event_type 27) are not stored in the same table and
             *     carry a namespaced string id instead, in the form <code>lead-&lt;id&gt;</code>.
             */
            id?: number | string;
            /** @description timeline event details */
            details?: string | null;
            /**
             * Format: date-time
             * @description event time
             */
            event_time?: string;
            /**
             * @description event type <br>
             *     0: Joined organization <br>
             *     1: Updated profile <br>
             *     2: Attended event <br>
             *     5: donated <br>
             *     6: withdrew monthly donation <br>
             *     7: custom note <br>
             *     8: cancelled monthly donation <br>
             *     9: donated birthday (deprecated) <br>
             *     10: paid membership dues <br>
             *     11: started fundraising campaign <br>
             *     12: finalized fundraising campaign <br>
             *     13: joined fundraising <br>
             *     14: filled form <br>
             *     15: bought ecard <br>
             *     16: unsubsribed (deprecated) <br>
             *     17: became monthly donor <br>
             *     18: allowed communication via phone <br>
             *     19: allowed communication via sms <br>
             *     20: allowed communication via email <br>
             *     21: disallowed communication via phone <br>
             *     22: disallowed communication via sms <br>
             *     23: disallowed communication via email <br>
             *     24: added relation with other contacts <br>
             *     25: removed relation from other contacts <br>
             *     26: asked for a donation reminder <br>
             *     27: acquisition lead - a recorded touchpoint between the contact and the
             *     organisation (donation, e-card, ticket, form, dues, import or an expression
             *     of interest). These rows come from a separate record and carry the extra
             *     lead_* fields below.
             * @enum {integer}
             */
            event_type?: 0 | 1 | 2 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27;
            /** @description Issuer first name (for custom notes) */
            issuer__first_name?: string | null;
            /** @description Issuer last name (for custom notes) */
            issuer__last_name?: string | null;
            /** @description calendar event id if timeline note is connected to a calendar event */
            calendarevent__id?: number | null;
            /** @description calendar event note if timeline note is connected to a calendar event */
            calendarevent__note?: string | null;
            /**
             * Format: date-time
             * @description calendar event date if timeline note is connected to a calendar event
             */
            calendarevent__date?: string | null;
            /** @description if time events connected calendar event is marked as completed */
            calendarevent__completed?: boolean | null;
            /** @description custom note tag id */
            tag_id?: number | null;
            /** @description custom note tag name */
            tag__name?: string | null;
            /**
             * @description custom note tag color
             * @enum {string|null}
             */
            tag__color?: "tag-1" | "tag-2" | "tag-3" | "tag-4" | "tag-5" | "tag-6" | "tag-7" | "tag-8" | null;
            /** @description if timeline event has custom date */
            custom_date?: boolean;
            /**
             * @description kind of touchpoint. Only present when event_type is 27 <br>
             *     0: donation <br>
             *     1: became monthly donor <br>
             *     2: e-card purchase <br>
             *     3: event ticket <br>
             *     4: form submission <br>
             *     5: dues payment <br>
             *     6: excel import <br>
             *     7: manual entry <br>
             *     8: reminder capture <br>
             *     9: peer fundraising <br>
             *     10: API / third-party
             * @enum {integer}
             */
            lead_type?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
            /**
             * @description what became of the touchpoint. Only present when event_type is 27 <br>
             *     0: interest only, no payment attempted <br>
             *     1: converted, produced a successful result <br>
             *     2: failed, payment declined <br>
             *     3: pending, scheduled or awaiting a wire match <br>
             *     4: reversed, succeeded then refunded or cancelled
             * @enum {integer}
             */
            outcome?: 0 | 1 | 2 | 3 | 4;
            /**
             * @description 1-based position of this touchpoint among the contact's leads, oldest first.
             *     Only present when event_type is 27
             */
            sequence_no?: number;
            /**
             * @description whether this is the contact's earliest touchpoint, the one that defines their
             *     acquisition cohort. Only present when event_type is 27
             */
            is_first_touch?: boolean;
            /**
             * @description value of the touchpoint, when it carries one. Only present when event_type is
             *     27, and null for touchpoints that produced no money
             */
            amount?: number | null;
            /**
             * @description display symbol of the currency of amount. Only present when event_type is 27.
             *     Never aggregate amounts across currencies
             */
            currency__display?: string | null;
            /**
             * @description name of the operator who collected the touchpoint, where one did. Only present
             *     when event_type is 27
             */
            added_by__name?: string | null;
            /** @description if the event is pinned to the top of the timeline */
            pinned?: boolean;
        };
        Tag: {
            /** @description Tag id */
            id?: number;
            /** @description Tag name */
            name?: string;
            /**
             * @description Tag color
             * @enum {string}
             */
            color?: "tag-1" | "tag-2" | "tag-3" | "tag-4" | "tag-5" | "tag-6" | "tag-7" | "tag-8";
        };
        EventTicketCreation: {
            /** @description Ticket id */
            id?: number;
        };
        EventTicket: {
            /** @description Ticket id */
            id?: number;
            /** @description Ticket name */
            title?: string;
            /** @description Sold count */
            sold?: number;
            /** @description Quantity count */
            quantity?: number;
            /**
             * Format: double
             * @description Price
             */
            price?: number;
            /**
             * @description Ticket type <br>
             *     - paid: paid ticket <br>
             *     - free: free ticket
             * @enum {string}
             */
            ticket_type?: "paid" | "free";
            /** @description ticket description */
            details?: string;
            /** @description message to be shown after the ticket is purchased */
            post_sale_message?: string;
            /** @description true if ticket sale must start on specific date */
            sales_start_on_date?: boolean;
            /**
             * Format: date-time
             * @description Ticket sale start date
             */
            sales_start?: string;
            /** @description true if ticket sale must end on specific date */
            sales_end_on_date?: boolean;
            /**
             * Format: date-time
             * @description Ticket sale end date
             */
            sales_end?: string;
            /** @description maximum number of tickets a user can buy */
            max_per_person?: number;
            /** @description tickets order */
            order?: number;
            /**
             * @description ticket can only be bought by users with selected tags <br>
             *     - 0: No control <br>
             *     - 1: Ok if user has any of the selected tags <br>
             *     - 2: Ok if user has all of the selected tags
             * @enum {integer}
             */
            tag_control?: 0 | 1 | 2;
            /** @description tag_id's for tag control */
            tags_to_control?: number[];
            /** @description true if ticket can only be bought by users with no debt */
            member_with_no_debt?: boolean;
            /** @description true if ticket can only be bought if users related organization has no debt */
            related_with_no_debt?: boolean;
        };
        PaymentSettings: {
            /** @description payment settings id */
            id?: number;
            /** @description Payment setting name */
            name?: string;
            /**
             * @description payment provider type <br>
             *     - vpos for virtual POS of Bank <br>
             *     - iyzico for iyzico <br>
             *     - paratika for paratika <br>
             *     - msu for Merchant Safe Unipay <br>
             *     - payu for PayU <br>
             *     - ipara for iPara <br>
             *     - paypal for PayPal <br>
             *     - stripe for Stripe
             * @enum {string}
             */
            provider_no?: "vpos" | "iyzico" | "paratika" | "msu" | "payu" | "ipara" | "paypal" | "stripe";
            /** @description payment settings status */
            status?: number;
            /** @description True if payment settings belongs to business account */
            business_account?: boolean;
        };
        BankAccountReference: {
            /** @description Bank Account Id */
            id?: number;
            /** @description Bank Account name */
            name?: string;
            /** @description Accounts Currency ID */
            currency_id?: number;
        };
        /** @description An incoming wire transfer recorded against a bank account. */
        BankAccountTransaction: {
            /** @description Transaction Id */
            id?: number;
            /**
             * Format: float
             * @description Transferred amount
             */
            amount?: number;
            /**
             * @description ISO 4217 currency code of the amount
             * @example TRY
             */
            currency_code?: string;
            /**
             * Format: date-time
             * @description When the bank recorded the transfer
             */
            complete_date?: string;
            /**
             * @description Reconciliation state. `3` matched, `8` waiting to be matched,
             *     `9` will not be matched.
             * @enum {integer}
             */
            payment_status?: 3 | 8 | 9;
            /**
             * @description What a matched transfer became. `1` donation, `2` membership dues,
             *     `4` e-card. Null while the transfer is unmatched.
             * @enum {integer|null}
             */
            transaction_type?: 1 | 2 | 4 | null;
            /** @description Sender name as reported by the bank */
            counterparty_name?: string | null;
            /** @description Sender IBAN as reported by the bank, masked by some providers */
            counterparty_iban?: string | null;
            /** @description Sender tax number (VKN) or national id (TCKN), when the bank supplies one */
            counterparty_vkn?: string | null;
            /** @description Sending bank name */
            counterparty_bank?: string | null;
            /** @description The payer's own note on the transfer, verbatim */
            description?: string | null;
            /** @description Bank reference number for the transfer */
            reference?: string | null;
            /** @description Transfer channel as labelled by the bank, e.g. EFT or FAST */
            bank_transaction_type?: string | null;
            /** @description Statement sequence number */
            sequence_no?: string | null;
            /** @description Bank integration that produced the record */
            provider?: string | null;
            /** @description Contact the transfer was matched to, when there is one */
            matched_user_id?: number | null;
            /** @description Name of the matched contact */
            matched_user_name?: string | null;
            /** @description Donation created by matching this transfer */
            matched_donation_id?: number | null;
            /** @description Dues payment created by matching this transfer */
            matched_subscription_id?: number | null;
            /** @description E-card sale created by matching this transfer */
            matched_certificate_sale_id?: number | null;
        };
        BankAccount: {
            /** @description Bank Account Id */
            id?: number;
            /** @description Bank Account name */
            name?: string;
            /** @description Bank name */
            bank_name?: string;
            /** @description IBAN */
            iban?: string;
            /** @description Additional details */
            details?: string;
            /** @description Accounts Currency ID */
            currency_id?: number;
            /** @description Currency Display */
            currency__display?: string;
            /** @description True if payment settings belongs to business account */
            business_account?: boolean;
            /**
             * Format: date-time
             * @description create date
             */
            create_date?: string;
            /** @description Account created by user id */
            created_by_id?: number;
            /** @description Account created by user name */
            created_by__name?: string;
            /**
             * Format: date-time
             * @description update date
             */
            update_date?: string;
            /** @description Account last updated by user id */
            updated_by_id?: number;
            /** @description Account last updated by user name */
            updated_by__name?: string;
        };
        MarketingChannel: {
            /** @description Marketing Channel id */
            id?: number;
            /** @description utm_source value */
            utm_source?: string;
            /** @description utm_medium value */
            utm_medium?: string;
            /** @description utm_campaign value */
            utm_campaign?: string;
            /** @description utm_content value */
            utm_content?: string;
            /**
             * Format: date-time
             * @description Channel first-seen date
             */
            create_date?: string;
            /** @description Count of successful donations attributed to this channel */
            donations?: number;
            /** @description Count of successful e-card sales attributed to this channel */
            ecards?: number;
        };
        Transaction: {
            /** @description transaction id */
            id?: number;
            /** @description conversation id */
            conversation_id?: number;
            /**
             * Format: date-time
             * @description complete date
             */
            complete_date?: string;
            /**
             * Format: double
             * @description amount
             */
            amount?: number;
            currency?: components["schemas"]["Currency"];
            /** @description installment count */
            installment_count?: number;
            /**
             * Format: double
             * @description installment amount
             */
            installment_amount?: number;
            /** @description ip address */
            ip_address?: string;
            /** @description payment status */
            payment_status?: number;
            /** @description payment status display */
            payment_status_display?: string;
            /** @description error code */
            error_code?: string;
            /** @description error text */
            error_text?: string;
            /**
             * Format: date-time
             * @description refund date
             */
            refund_date?: string;
            /** @description bank order id */
            fonzip_id?: string;
            /** @description bank order hashed */
            fonzip_id_hashed?: string;
            /** @description bank transaction id */
            transaction_id?: string;
            /** @description bank provision no */
            provision_no?: string;
            /** @description receipt no */
            receipt_no?: string;
            /** @description bank auth code */
            auth_code?: string;
            /** @description bank reference id */
            reference_id?: string;
            /** @description bank order id */
            order_id?: string;
            /** @description payment settings id */
            payment_settings_id?: number;
            payment_settings?: components["schemas"]["PaymentSettings"];
            /** @description bank account id */
            bank_account_id?: number;
            bank_account?: components["schemas"]["BankAccountReference"];
            payment_method?: components["schemas"]["PaymentMethod"];
            /** @description User id who refunded donation */
            refunded_by_id?: number;
            /** @description Users name who refunded donation */
            refunded_by__name?: string;
            /** @description Refund Reason */
            refund_reason?: string;
            /** @description transaction through fonzip */
            fonzip_framework?: boolean;
            /** @description card bin number */
            bin_number?: string;
            /** @description card last four */
            last_four?: string;
        };
        TicketSaleDetails: {
            /** @description single ticket id */
            id?: number;
        };
        SentEmail: {
            /** @description Sent email id */
            id?: number;
            /** @description Sent email message id */
            message_id?: number;
            /**
             * @description Sent email status  <br>
             *     - 0: Sent <br>
             *     - 1: Delivered <br>
             *     - 2: Opened <br>
             *     - 3: Clicked <br>
             *     - 4: Error <br>
             *     - 5: Invalid <br>
             *     - 6: Deferred <br>
             *     - 7: Unsubscribed <br>
             *     - 8: Bounced <br>
             *     - 9: Unknown <br>
             *     - 10: Spam <br>
             *     - 11: Blocked <br>
             *     - 12: Hard Bounced
             * @enum {integer}
             */
            status?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
        };
        FundraisingCampaignList: {
            /** @description Fundraising campaign id */
            id?: number;
            /** @description User id */
            user_id?: number;
            /** @description User first name */
            user__first_name?: string;
            /** @description User last name */
            user__last_name?: string;
            /** @description user unified name */
            user__name?: number;
            /**
             * Format: date-time
             * @description create date
             */
            create_date?: string;
            /**
             * Format: date-time
             * @description activation date
             */
            activation_date?: string;
            /**
             * Format: date-time
             * @description finalize date
             */
            finish_date?: string;
            /** @description campaign title */
            title?: string;
            /** @description campaign url extension */
            url?: string;
            /**
             * @description campaign status  <br>
             *     - 0: waiting approval <br>
             *     - 1: approved <br>
             *     - 2: rejected <br>
             *     - 3: finalized <br>
             *     - 4: deleted <br>
             *     - 5: waiting extra approval <br>
             *     - 7: archived
             * @enum {integer}
             */
            status?: 0 | 1 | 2 | 3 | 4 | 5 | 7;
            /**
             * Format: double
             * @description total donation
             */
            donation_total?: number;
            /** @description fundraising campaign team id */
            team_id?: number;
            /** @description fundraising campaign team title */
            team_campaign__title?: string;
            /** @description fundraising campaign target currency id */
            target_currency_id?: number;
            /** @description fundraising campaign target currency display */
            target_currency__display?: number;
            /**
             * @description true if the campaign is pinned to the Featured Campaigns block on the public fundraising landing page.
             *     Up to 6 campaigns per association may be featured at once. The flag auto-clears when a campaign leaves
             *     an active status (finalize / archive / reject / delete).
             */
            featured?: boolean;
        };
        FundraisingCampaignUpdate: {
            /** @description true if updating multiple fields */
            multiple?: boolean;
            /**
             * @description field to be updated
             * @enum {string}
             */
            field?: "title" | "image" | "bank_account_list" | "personal_message" | "has_target" | "hide_donor_list" | "hide_total_donation" | "has_special_date" | "phone_show" | "phone_required" | "birthday_show" | "birthday_required" | "address_show" | "address_required" | "tckno_show" | "tckno_required" | "message_show" | "target" | "event_date" | "sub_donation_type_id" | "payment_settings_id" | "thanks_mail_id" | "referral_thanks_mail_id" | "thanks_sms_id" | "certificate_id" | "referral_certificate_id" | "association_campaign_target_id";
            value?: string | number | boolean | unknown[];
            /** @description key value pairs of fields and values (see example) */
            data?: Record<string, unknown>;
        };
        FundraisingCampaign: {
            /** @description Fundraising campaign id */
            id?: number;
            /** @description userid */
            user_id?: number;
            /** @description campaign title */
            title?: string;
            /** @description campaign url */
            url?: string;
            /**
             * Format: url
             * @description campaign image url
             */
            image?: string;
            /** @description campaign message */
            personal_message?: string;
            /** @description users note */
            user_note?: string;
            /** @description campaign has target */
            has_target?: boolean;
            /** @description total donations is hidden or not */
            hide_total_donation?: boolean;
            /** @description donor list is hidden or not */
            hide_donor_list?: boolean;
            /**
             * Format: double
             * @description campaign target
             */
            target?: number;
            /** @description fundraising campaign target currency id */
            target_currency_id?: number;
            /**
             * @description campaign status <br>
             *     - 0: waiting approval <br>
             *     - 1: approved <br>
             *     - 2: rejected <br>
             *     - 3: finalized <br>
             *     - 4: deleted <br>
             *     - 5: waiting extra approval <br>
             *     - 7: archived
             * @enum {integer}
             */
            status?: 0 | 1 | 2 | 3 | 4 | 5 | 7;
            /** @description True if campaign has a event date like birthday, memorial day etc. */
            has_special_date?: boolean;
            /**
             * Format: date
             * @description Event date
             */
            event_date?: string;
            bank_account_list?: components["schemas"]["BankAccount"][];
            /** @description true if phone is asked */
            phone_show?: boolean;
            /** @description true if phone is required */
            phone_required?: boolean;
            /** @description true if birthday is asked */
            birthday_show?: boolean;
            /** @description true if birthday is required */
            birthday_required?: boolean;
            /** @description true if address is asked */
            address_show?: boolean;
            /** @description true if address is required */
            address_required?: boolean;
            /** @description true if tckno is asked */
            tckno_show?: boolean;
            /** @description true if tckno is required */
            tckno_required?: boolean;
            /** @description true if donors may leave a message. Ships enabled, unlike the other *_show flags */
            message_show?: boolean;
            /** @description donation category id */
            sub_donation_type_id?: number;
            /** @description thanks mail id */
            thanks_mail_id?: number;
            /** @description payment system id */
            payment_settings_id?: number;
            /** @description valid currencies */
            currencies?: number[];
            /** @description certificate */
            certificate_id?: number;
            /** @description thanks sms id */
            thanks_sms_id?: number;
            /** @description referral certificate id */
            referral_certificate_id?: number;
            /** @description referral thanks mail id */
            referral_thanks_mail_id?: number;
            /** @description fundraising event id */
            association_campaign_target_id?: number;
        };
        FundraisingEvent: {
            /** @description fundraising event id */
            id?: number;
            /** @description fundraising event name */
            title: string;
            /** @description true if the fundraising event has a target */
            has_target?: boolean;
            /**
             * Format: double
             * @description fundraising event target, used when has_target is true
             */
            target?: number;
            /** @description fundraising event target currency id. Required when has_target is true; when has_target is false the association's default currency is used. */
            target_currency_id?: number;
            /** @description fundraising event image URL. Must be an http(s) URL. When omitted, the association's default campaign image is used; on update, an event already carrying an image keeps it if the association has set no default. */
            image?: string;
        };
        FundraisingEventDetail: {
            /** @description fundraising event id */
            id?: number;
            /** @description fundraising event name */
            title?: string;
            /**
             * Format: double
             * @description fundraising event target
             */
            target?: number;
            /**
             * Format: double
             * @description donation sum
             */
            donation_sum?: number;
            /** @description donation count */
            donation_count?: number;
            /** @description how many campaigns */
            campaign_count?: number;
        };
        FundraisingTeamDetail: {
            /** @description fundraising team id */
            id?: number;
            /** @description user id */
            user_id?: number;
            /** @description Related user name & surname */
            user__name?: string;
            /** @description fundraising team name */
            title?: string;
            /**
             * Format: url
             * @description fundraising team image url
             */
            image?: string;
            /** @description fundraising team page url */
            slug?: string;
            /** @description Teams default currency id */
            currency_id?: number;
            /**
             * Format: float
             * @description Teams default currency value compared to TRY
             */
            currency__value?: number;
            /** @description Teams default currency display */
            currency__display?: string;
            /**
             * Format: date-time
             * @description fundraising team start date
             */
            create_date?: string;
            /**
             * @description fundraising team status <br>
             *     - 0: waiting approval <br>
             *     - 1: approved <br>
             *     - 2: rejected <br>
             *     - 3: waiting extra approval <br>
             *     - 4: deleted <br>
             *     - 5: archived
             * @enum {number}
             */
            status?: 0 | 1 | 2 | 3 | 4 | 5;
            /**
             * Format: double
             * @description donation sum
             */
            donation_sum?: number;
            /** @description donation count */
            donation_count?: number;
        };
        TicketSale: {
            /** @description ticket sale id */
            id?: number;
            transaction?: components["schemas"]["Transaction"];
            event?: components["schemas"]["Event"];
            sold_tickets?: components["schemas"]["TicketSaleDetails"][];
            member?: components["schemas"]["UserDetails"];
            /** @description buyer name */
            name?: string;
            /** @description phone */
            phone?: string;
            /**
             * Format: email
             * @description email
             */
            email?: string;
            /** @description address */
            address?: string;
            /** @description city */
            city?: string;
            /** @description district */
            district?: string;
            /** @description post code */
            post_code?: string;
            /** @description details */
            details?: string;
            sent_mail?: components["schemas"]["SentEmail"];
        };
        CreateEvent: {
            /** @description Event name */
            name?: string;
            /** @description Event URL */
            url?: string;
            /** @description Event venue */
            venue?: number;
            /** @description Event address */
            address?: string;
            /** @description Event details */
            details?: string;
            /** @description Event has paid tickets */
            paid_event?: boolean;
            /** @description Payment settings id */
            payment_settings_id?: number;
            /**
             * Format: url
             * @description Event image url
             */
            image?: string;
            /**
             * Format: date-time
             * @description Event start date
             */
            start_date?: string;
            /** @description Event takes all day */
            all_day?: boolean;
            /**
             * Format: date-time
             * @description Event end date
             */
            end_date?: string;
            ticket_types?: components["schemas"]["EventTicketCreation"][];
            /** @description maximum number of installments for event */
            max_installment?: number;
            /** @description should a reminder sent to the participants one day before the event */
            send_reminder?: boolean;
            /** @description additional billing info is required or not */
            ask_billing_info?: boolean;
            /**
             * @description Whether event is held online or at a venue <br>
             *     - 0: Venue <br>
             *     - 1: Online
             * @enum {integer}
             */
            location?: 0 | 1;
            /** @description Email sender account id for event */
            sender_account_id?: number;
        };
        Event: {
            /** @description Event id */
            id?: number;
            /** @description Event name */
            name?: string;
            /** @description Event URL */
            url?: string;
            /** @description Event venue */
            venue?: number;
            /** @description Event address */
            address?: string;
            /** @description Event details */
            details?: string;
            /** @description Event has paid tickets */
            paid_event?: boolean;
            /** @description Payment settings id */
            payment_settings_id?: number;
            /**
             * Format: url
             * @description Event image url
             */
            image?: string;
            /**
             * Format: date-time
             * @description Event start date
             */
            start_date?: string;
            /** @description Event takes all day */
            all_day?: boolean;
            /**
             * Format: date-time
             * @description Event end date
             */
            end_date?: string;
            ticket_types?: components["schemas"]["EventTicket"][];
            /** @description event is active or not */
            active?: boolean;
            /** @description maximum number of installments for event */
            max_installment?: number;
            /** @description should a reminder sent to the participants one day before the event */
            send_reminder?: boolean;
            /** @description additional billing info is required or not */
            ask_billing_info?: boolean;
            /**
             * @description Whether event is held online or at a venue <br>
             *     - 0: Venue <br>
             *     - 1: Online
             * @enum {integer}
             */
            location?: 0 | 1;
            /** @description Email sender account id for event */
            sender_account_id?: number;
        };
        EventList: {
            /** @description Event id */
            id?: number;
            /** @description Event url */
            url?: string;
            /** @description Event name */
            name?: string;
            /**
             * Format: date-time
             * @description start date
             */
            start_date?: string;
            /**
             * Format: date-time
             * @description end date
             */
            end_date?: string;
            /** @description Event takes all day */
            all_day?: boolean;
            /** @description Event is active */
            active?: boolean;
            /** @description event timezone */
            timezone?: string;
            /**
             * Format: date-time
             * @description campaign create date
             */
            create_date?: string;
            /** @description Event created by user id */
            created_by_id?: number;
            /** @description Event created by user name */
            created_by__name?: string;
            /**
             * Format: date-time
             * @description last update date
             */
            update_date?: string;
            /** @description Event last updated by user id */
            updated_by_id?: number;
            /** @description Event last updated by user name */
            updated_by__name?: string;
            /** @description Event archived by user id */
            archived_by_id?: number;
            /** @description Event archived by user name */
            archived_by__name?: string;
            /**
             * Format: date-time
             * @description archive date
             */
            archive_date?: string;
        };
        DebtCategory: {
            /** @description Debt category id */
            id?: number;
            /** @description Debt category name */
            name?: string;
            /** @description True once the category is deleted */
            deleted?: boolean;
        };
        DebtCategoryListItem: {
            /** @description Debt category id */
            id?: number;
            /** @description Debt category name */
            name?: string;
            /**
             * Format: date-time
             * @description Record creation timestamp
             */
            create_date?: string;
            /** @description User id who created it; null when created through the API */
            created_by_id?: number | null;
            /** @description User name who created it */
            created_by__name?: string | null;
            /**
             * Format: date-time
             * @description Last rename timestamp
             */
            update_date?: string | null;
            /** @description User id who last renamed it */
            updated_by_id?: number | null;
            /** @description User name who last renamed it */
            updated_by__name?: string | null;
            /** @description Unpaid and paid debts */
            debt_count?: number;
            /** @description Unpaid debts */
            open_count?: number;
            /**
             * Format: double
             * @description Amount of the unpaid debts
             */
            open_amount?: number;
            /** @description Paid debts */
            closed_count?: number;
            /**
             * Format: double
             * @description Amount of the paid debts
             */
            closed_amount?: number;
            /** @description Removed debts */
            removed_count?: number;
            /**
             * Format: double
             * @description Amount of the unpaid and paid debts
             */
            total_amount?: number;
            /** @description Members with an unpaid debt in the category */
            open_member_count?: number;
            /** @description Debts of active members, which `/debts` lists */
            listed_count?: number;
        };
        DebtCategoryUsage: {
            category?: {
                id?: number;
                name?: string;
            };
            /** @description Unpaid and paid debts */
            debt_count?: number;
            /** @description Unpaid debts */
            open_count?: number;
            /**
             * Format: double
             * @description Amount of the unpaid debts
             */
            open_amount?: number;
            /** @description Paid debts */
            closed_count?: number;
            /**
             * Format: double
             * @description Amount of the paid debts
             */
            closed_amount?: number;
            /** @description Removed debts */
            removed_count?: number;
            /**
             * Format: double
             * @description Amount of the unpaid and paid debts
             */
            total_amount?: number;
            /** @description Members with an unpaid debt in the category */
            open_member_count?: number;
            /** @description Debts of active members, which `/debts` lists */
            listed_count?: number;
            /** @description Live add-debt automations that raise debts in the category */
            automation_list?: {
                id?: number;
                title?: string;
            }[];
            /** @description True when deleting it needs a `replacement_id` */
            in_use?: boolean;
        };
        DonationCategory: {
            /** @description Category id */
            id?: number;
            /** @description Category name */
            name?: string;
            /** @description Category active or not */
            active?: boolean;
            /**
             * Format: date-time
             * @description page create date
             */
            create_date?: string;
            /** @description Page created by user id */
            created_by_id?: number;
            /** @description Page created by user name */
            created_by__name?: string;
            /**
             * Format: date-time
             * @description last update date
             */
            update_date?: string;
            /** @description Page last updated by user id */
            updated_by_id?: number;
            /** @description Page last updated by user name */
            updated_by__name?: string;
            /**
             * Format: date-time
             * @description last donation date
             */
            last_donation_date?: string;
        };
        EcardCategory: {
            /** @description Category id */
            id?: number;
            /** @description Category name */
            name?: string;
            /** @description Category Order */
            order?: string;
            /**
             * Format: date-time
             * @description page create date
             */
            create_date?: string;
            /** @description Page created by user id */
            created_by_id?: number;
            /** @description Page created by user name */
            created_by__name?: string;
            /**
             * Format: date-time
             * @description last update date
             */
            update_date?: string;
            /** @description Page last updated by user id */
            updated_by_id?: number;
            /** @description Page last updated by user name */
            updated_by__name?: string;
        };
        DonationPageList: {
            /** @description donation page id */
            id?: number;
            /** @description donation page order for listing */
            order?: number;
            /** @description donation page title */
            title?: string;
            /** @description donation page url */
            url?: string;
            /** @description page is active or not */
            active?: boolean;
            /** @description page is listing or not */
            listing?: boolean;
            /**
             * Format: date-time
             * @description last donation date
             */
            last_donation_date?: string;
            /**
             * Format: date-time
             * @description page create date
             */
            create_date?: string;
            /** @description Page created by user id */
            created_by_id?: number;
            /** @description Page created by user name */
            created_by__name?: string;
            /**
             * Format: date-time
             * @description last update date
             */
            update_date?: string;
            /** @description Page last updated by user id */
            updated_by_id?: number;
            /** @description Page last updated by user name */
            updated_by__name?: string;
        };
        DonationFormList: {
            /** @description donation form id */
            id?: number;
            /** @description donation form order for listing */
            order?: number;
            /** @description donation form title */
            title?: string;
            /** @description donation form url */
            api_url?: string;
            /** @description form is active or not */
            live?: boolean;
            /** @description donation form version */
            version?: number;
            /**
             * Format: date-time
             * @description last donation date
             */
            last_donation_date?: string;
            /**
             * Format: date-time
             * @description form create date
             */
            create_date?: string;
            /** @description form created by user id */
            created_by_id?: number;
            /** @description form created by user name */
            created_by__name?: string;
            /**
             * Format: date-time
             * @description last update date
             */
            update_date?: string;
            /** @description form last updated by user id */
            updated_by_id?: number;
            /** @description form last updated by user name */
            updated_by__name?: string;
        };
        DonationResult: {
            /** @description donation id */
            id?: number;
            /** @description user id */
            user_id?: number;
            /** @description Transaction through Fonzip */
            transaction__fonzip_framework?: boolean;
            /**
             * @description recurring donation status <br>
             *     - 0: single <br>
             *     - 1: active <br>
             *     - 2: has error <br>
             *     - 3: cancelled <br>
             *     - 4: has not started
             * @enum {integer}
             */
            recurring_status?: 0 | 1 | 2 | 3 | 4;
            /**
             * @description Payment status <br>
             *     - 0: initialized <br>
             *     - 1: processing <br>
             *     - 2: 3d secure initialized <br>
             *     - 3: successful <br>
             *     - 4: refunded <br>
             *     - 5: failed <br>
             *     - 6: removed
             * @enum {integer}
             */
            transaction__payment_status?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
            /**
             * @description Donation Type <br>
             *     - 0: cash <br>
             *     - 1: noncash
             * @enum {integer}
             */
            d_type?: 0 | 1;
            /**
             * Format: email
             * @description email
             */
            email?: string;
            /**
             * Format: email
             * @description users email
             */
            user__email?: string;
            /** @description explanation */
            details?: string;
            /** @description donor name */
            name?: string;
            /** @description user first name */
            user__first_name?: string;
            /** @description user last name */
            user__last_name?: string;
            /** @description address */
            address?: string;
            /** @description city */
            city?: string;
            /** @description district */
            district?: string;
            /**
             * Format: double
             * @description dontion amount
             */
            transaction__amount?: number;
            /** @description currency */
            transaction__currency__display?: string;
            /** @description currency iso code */
            transaction__currency__iso_code?: string;
            /** @description donation category id */
            sub_donation_type_id?: number;
            /** @description donation category name */
            sub_donation_type__name?: string;
            /**
             * Format: date
             * @description Birthday
             */
            birthday?: string;
            /** @description mail sytem id */
            sent_mail_id?: number;
            /** @description mail outbound id */
            sent_mail__message_id?: number;
            /** @description mail status */
            sent_mail__status?: number;
            /** @description referring mail sytem id */
            sent_mail_to_referring_id?: number;
            /** @description referring mail outbound id */
            sent_mail_to_referring__message_id?: number;
            /** @description referring mail status */
            sent_mail_to_referring__status?: number;
            /**
             * Format: date-time
             * @description donation date
             */
            transaction__complete_date?: string;
            /** @description Fundraising campaign id */
            fundraising_campaign_id?: number;
            /** @description Fundraising campaign title */
            fundraising_campaign__title?: string;
            /** @description identity number */
            tckno?: string;
            /** @description phone */
            phone?: string;
            /** @description Fundraising page id */
            fundraising_page_id?: number;
            /** @description Fundraising page title */
            fundraising_page__title?: string;
            /** @description donation form id */
            module_id?: number;
            /** @description donation form title */
            module__title?: string;
            transaction__payment_method?: components["schemas"]["PaymentMethod"];
            /** @description User id who added donation */
            added_by_id?: number;
            /** @description User name who added donation */
            added_by__name?: string;
            /** @description Face to face group id */
            f2f_group_id?: number;
            /** @description Face to face group title */
            f2f_group__title?: string;
            /** @description bank order id */
            transaction__fonzip_id?: string;
            /** @description monthly donation order id */
            recurring_order_id?: string;
            /** @description withdraw count of monthly donation */
            recurring_withdraw_count?: number;
            /** @description total withdraw count of monthly donation */
            recurring_total_withdraw_count?: number;
            /** @description total withdraw amount of monthly donation */
            recurring_total_withdraw_amount?: number;
            /** @description bank transaction id */
            transaction__transaction_id?: string;
            /** @description bank provision no */
            transaction__provision_no?: string;
            /** @description bank auth code */
            transaction__auth_code?: string;
            /** @description bank reference id */
            transaction__reference_id?: string;
            /** @description transactions IP address */
            transaction__ip_address?: string;
            /** @description transactions bank account name */
            transaction__bank_account__name?: string;
            /** @description transactions payment system name */
            transaction__payment_settings__name?: string;
            /** @description Fundraising campaign owners' id */
            fundraising_campaign__user_id?: number;
            /** @description Fundraising campaign owners' name */
            fundraising_campaign__user__title?: string;
            /** @description API tracking */
            api_tracking_id?: string;
            /** @description allow communication via phone */
            news_via_phone?: boolean;
            /** @description allow communication via sms */
            news_via_sms?: boolean;
            /** @description allow communication via email */
            news_via_email?: boolean;
            /** @description 3rd party application id */
            application_id?: number;
            /** @description 3rd party application name */
            application__title?: string;
            /** @description Card BIN Number */
            transaction__bin_number?: string;
            /** @description Receipt No for donation */
            transaction__receipt_no?: string;
            /**
             * @description donor type
             * @enum {string}
             */
            donor_type?: "personal" | "corporate";
            /** @description if amount is visible in fundraising campaign */
            amount_visible?: boolean;
            /** @description if name is hidden in fundraising campaign */
            name_hidden?: boolean;
            /** @description optional message left by the donor on a fundraising campaign donation */
            message?: string | null;
            /** @description if the donor consented to their message being listed publicly */
            show_message?: boolean;
            /** @description Honoree's name */
            referring_name?: string;
            /** @description Honoree's email */
            referring_email?: string;
            /** @description Honoree's phone */
            referring_phone?: string;
            /**
             * Format: date-time
             * @description refund date
             */
            transaction__refund_date?: string;
            /** @description error code */
            transaction__transaction_error__code?: string;
            /** @description error text */
            transaction__transaction_error__text?: string;
            transaction__transaction_error__group?: components["schemas"]["TransactionErrorGroup"];
            /** @description User id who refunded donation */
            transaction__refunded_by_id?: number;
            /** @description User id who last updated donation */
            updated_by_id?: number;
            /**
             * Format: date-time
             * @description last update date of donation
             */
            last_update_date?: string;
            /** @description monthly donation cancellation reason */
            recurring_cancel_reason?: string;
            /**
             * Format: date-time
             * @description monthly donation cancellation date
             */
            recurring_cancel_date?: string;
            /**
             * Format: date-time
             * @description monthly donation start date
             */
            recurring_start_date?: string;
            /** @description User id who cancelled monthly donation */
            cancelled_by_id?: number;
            /** @description User name who cancelled monthly donation */
            cancelled_by__name?: string;
            /** @description UTM source */
            marketing_channel__utm_source?: string;
            /** @description UTM medium */
            marketing_channel__utm_medium?: string;
            /** @description UTM campaign */
            marketing_channel__utm_campaign?: string;
            /** @description UTM content */
            marketing_channel__utm_content?: string;
        };
        MembershipDueDetails: {
            /** @description due id */
            id?: number;
            /** @description user id */
            user_id?: number;
            user?: components["schemas"]["UserReference"];
            transaction?: components["schemas"]["Transaction"];
            /**
             * @description membership due record status <br>
             *     - 1: Unpaid Debt <br>
             *     - 2: Payment <br>
             *     - 3: Cancelled <br>
             *     - 4: Refunded <br>
             *     - 6: Removed Debt <br>
             *     - 7: Fixed Balance <br>
             *     - 8: Paid Debt
             * @enum {integer}
             */
            status?: 1 | 2 | 3 | 4 | 6 | 7 | 8;
            /** @description membership due record status name */
            status_name?: string;
            /** @description details for membership due record */
            details?: string;
            /** @description Why the debt was removed, for a removed debt */
            remove_note?: string | null;
            /** @description The debt's category; null for none and for payments */
            debt_category?: components["schemas"]["DebtCategory"] | null;
            /**
             * Format: date-time
             * @description Membership Due Operation Date
             */
            operation_date?: string;
            /**
             * Format: date
             * @description Period Date
             */
            period?: string;
            /**
             * Format: double
             * @description Users balance
             */
            balance?: number;
            /** @description Users first name */
            first_name?: string;
            /** @description Users last name */
            last_name?: string;
            /** @description phone */
            phone?: string;
            /**
             * Format: email
             * @description email
             */
            email?: string;
            /** @description identity number */
            tckno?: string;
            /**
             * Format: double
             * @description payment/debt amount
             */
            amount?: number;
            /**
             * @description records assignment status <br>
             *     - 0: not paid & not assigned <br>
             *     - 1: paid & not assigned <br>
             *     - 2: paid & assigned <br>
             *     - 3: paid & rejected <br>
             *     - 4: not paid & assigned
             * @enum {integer}
             */
            assignment_status?: 0 | 1 | 2 | 3 | 4;
            /** @description masked card number for membership due */
            card_info?: string;
            /** @description bill no */
            bill_no?: string;
            /**
             * Format: date-time
             * @description Debts Due Date
             */
            due_date?: string;
            /** @description Recurring Debt */
            recurring?: boolean;
            /**
             * Format: double
             * @description Recurring Debt Amount
             */
            recurring_amount?: number;
            /** @description Recurring period in days */
            recurring_period?: number;
            /** @description Recurring collection period in days */
            recurring_collection_period?: number;
            /** @description False if first recurring debt, True if the debt is occurrence */
            recurring_withdrawal?: boolean;
            /**
             * Format: date
             * @description Next occurrence date for recurring debt
             */
            recurring_next_cycle?: string;
            /** @description Recurring debt order id */
            order_id?: string;
            /** @description User id who added donation */
            added_by_id?: number;
            /** @description Users name who added donation */
            added_by__name?: string;
            /** @description User id who last updated donation */
            updated_by_id?: number;
            /** @description Users name who last updated donation */
            updated_by__name?: string;
        };
        DonationDetailResult: {
            /** @description donation id */
            id?: number;
            user?: components["schemas"]["UserReference"];
            transaction?: components["schemas"]["Transaction"];
            /**
             * @description Donation Type <br>
             *     - 0: cash <br>
             *     - 1: noncash
             * @enum {integer}
             */
            d_type?: 0 | 1;
            /** @description donation category */
            sub_donation_type_id?: number;
            /**
             * @description donor type
             * @enum {string}
             */
            donor_type?: "personal" | "corporate";
            /** @description donor name */
            name?: string;
            /** @description phone */
            phone?: string;
            /**
             * Format: email
             * @description email
             */
            email?: string;
            /** @description address */
            address?: string;
            /**
             * Format: date
             * @description Birthday
             */
            birthday?: string;
            /** @description city */
            city?: string;
            /** @description district */
            district?: string;
            /** @description explanation */
            details?: string;
            /** @description identity number */
            tckno?: string;
            /** @description allow communication via phone */
            news_via_phone?: boolean;
            /** @description allow communication via sms */
            news_via_sms?: boolean;
            /** @description allow communication via email */
            news_via_email?: boolean;
            /** @description limit for recurring donations. 0 if theres no limit */
            recurring_limit?: number;
            /** @description False if first recurring donation, True if the donation is a withdrawal */
            recurring_withdrawal?: boolean;
            /**
             * Format: float
             * @description Next withdrawal amount for recurring donation
             */
            recurring_next_amount?: number;
            /** @description Recurring donation error in case of recurring status is 2 */
            recurring_error?: string;
            /**
             * Format: date
             * @description Next withdrawal date for recurring donation
             */
            recurring_next_cycle?: string;
            /**
             * Format: date
             * @description Last successful withdrawal date for recurring debt
             */
            recurring_last_success_withdrawal_date?: string;
            /**
             * @description recurring donation status <br>
             *     - 0: single <br>
             *     - 1: active <br>
             *     - 2: has error <br>
             *     - 3: cancelled <br>
             *     - 4: has not started
             * @enum {integer}
             */
            recurring_status?: 0 | 1 | 2 | 3 | 4;
            /**
             * Format: date
             * @description Cancellation date for recurring donation
             */
            recurring_cancel_date?: string;
            /** @description Recurring donation order id */
            recurring_order_id?: string;
            /** @description Recurring withdraw count for recurring donation */
            recurring_withdraw_count?: number;
            /** @description Total withdraw count for recurring donation */
            recurring_total_withdraw_count?: number;
            /** @description Total withdraw amount for recurring donation */
            recurring_total_withdraw_amount?: number;
            /** @description True if donation is for an honoree */
            referring?: boolean;
            /** @description honoree's name */
            referring_name?: string;
            /** @description honoree's phone */
            referring_phone?: string;
            /** @description honoree's email */
            referring_email?: string;
            /** @description honoree's address */
            referring_address?: string;
            /** @description honoree's city */
            referring_city?: string;
            /** @description honoree's district */
            referring_district?: string;
            /** @description Recurring cancellation reason */
            recurring_cancel_reason?: string;
            /** @description True if donors name is hidden in fundraising campaign page */
            name_hidden?: boolean;
            /** @description True if donation amount is visible in fundraising campaign page */
            amount_visible?: boolean;
            /** @description Optional message left by the donor on a fundraising campaign donation */
            message?: string | null;
            /** @description True if the donor consented to their message being listed publicly */
            show_message?: boolean;
            /** @description fundraising campaign id */
            fundraising_campaign_id?: number;
            /** @description ngo fundraising page id */
            fundraising_page_id?: number;
            /** @description donation form id */
            module_id?: number;
            /** @description donation form name */
            module__name?: string;
            /** @description donation forms defined custom parameters */
            module__custom_parameters?: Record<string, unknown>;
            /** @description donations custom parameters */
            custom_parameters?: Record<string, unknown>;
            /** @description template id for success */
            thanks_mail_id?: number;
            /** @description 3rd party application id */
            application_id?: number;
            /** @description 3rd party application name */
            application__name?: string;
            /** @description API tracking ID */
            api_tracking_id?: string;
            sent_mail?: components["schemas"]["SentEmail"];
            sent_mail_to_referring?: components["schemas"]["SentEmail"];
            /** @description masked card number for recurring donation */
            card_info?: string;
            /** @description User id who added donation */
            added_by_id?: number;
            /** @description Users name who added donation */
            added_by__name?: string;
            /** @description User id who last updated donation */
            updated_by_id?: number;
            /** @description Users name who last updated donation */
            updated_by__name?: string;
            /**
             * Format: date-time
             * @description last update date of donation
             */
            last_update_date?: string;
        };
        UsersMonthlyDonation: {
            /** @description Donation id */
            id?: number;
            /** @description Donation category id */
            sub_donation_type_id?: number;
            /** @description Donation category name */
            sub_donation_type__name?: string;
            transaction__payment_method?: components["schemas"]["PaymentMethod"];
            /**
             * Format: date-time
             * @description Donation Date
             */
            transaction__complete_date?: string;
            /**
             * Format: double
             * @description Donation amount
             */
            transaction__amount?: number;
            /** @description Donation currency */
            transaction__currency__display?: string;
            /** @description Fundraising page id */
            fundraising_page_id?: number;
            /** @description Fundraising page title */
            fundraising_page__title?: string;
            /** @description Fundraising campaign id */
            fundraising_campaign_id?: number;
            /** @description Fundraising campaign title */
            fundraising_campaign__title?: string;
            /** @description 3rd party application id */
            application_id?: number;
            /** @description 3rd party application name */
            application__title?: string;
            /**
             * Format: float
             * @description Next withdrawal amount for recurring donation
             */
            recurring_next_amount?: number;
            /** @description users card info id */
            card_info_id?: number;
            /** @description monthly donation order id */
            recurring_order_id?: string;
            /** @description Donations User id */
            user_id?: number;
            /** @description card last four */
            card_info__last_four?: string;
            /**
             * @description recurring donation status <br>
             *     - 0: single <br>
             *     - 1: active <br>
             *     - 2: has error <br>
             *     - 3: cancelled <br>
             *     - 4: has not started
             * @enum {integer}
             */
            recurring_status?: 0 | 1 | 2 | 3 | 4;
            /**
             * Format: date
             * @description Next withdrawal date for monthly donation
             */
            recurring_next_cycle?: string;
            /**
             * @description Update Request Status <br>
             *     - null: No related update requests <br>
             *     - 0: Request Initiated <br>
             *     - 1: Cancelled <br>
             *     - 2: Not cancelled <br>
             *     - 3: Amount changed <br>
             *     - 4: Rejected
             * @enum {integer}
             */
            recurringcancelrequest__status?: 0 | 1 | 2 | 3 | 4;
            /**
             * @description Update Request Type <br>
             *     - null: No related update requests <br>
             *     - 0: Cancellation Request <br>
             *     - 1: Amount Upgrade Request
             * @enum {integer}
             */
            recurringcancelrequest__request_type?: 0 | 1;
        };
        UsersDonation: {
            /** @description Donation id */
            id?: number;
            /** @description Donation category id */
            sub_donation_type_id?: number;
            /** @description Donation category name */
            sub_donation_type__name?: string;
            /**
             * @description Donation Type <br>
             *     - 0: cash <br>
             *     - 1: noncash
             * @enum {integer}
             */
            d_type?: 0 | 1;
            transaction__payment_method?: components["schemas"]["PaymentMethod"];
            /**
             * Format: date-time
             * @description Donation Date
             */
            transaction__complete_date?: string;
            /**
             * Format: double
             * @description Donation amount
             */
            transaction__amount?: number;
            /** @description Donation currency */
            transaction__currency__display?: string;
            /**
             * @description Payment status <br>
             *     - 0: initialized <br>
             *     - 1: processing <br>
             *     - 2: 3d secure initialized <br>
             *     - 3: successful <br>
             *     - 4: refunded <br>
             *     - 5: failed <br>
             *     - 6: removed
             * @enum {integer}
             */
            transaction__payment_status?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
        };
        UsersMembershipDues: {
            /** @description Due id */
            id?: number;
            /**
             * @description Membership Due Status <br>
             *     - 1: Nonpaid debt <br>
             *     - 2: Payment <br>
             *     - 3: Cancellation <br>
             *     - 4: Refund <br>
             *     - 6: Removed/Inactive debt <br>
             *     - 7: Balance Fix <br>
             *     - 8: Paid debt
             */
            status?: number;
            /** @description Recurring Debt */
            recurring?: boolean;
            /**
             * Format: double
             * @description Recurring Debt Amount
             */
            recurring_amount?: number;
            /** @description Transaction through Fonzip */
            transaction__fonzip_framework?: boolean;
            /** @description Explanation */
            details?: string;
            /** @description Bill number */
            bill_no?: string;
            /**
             * Format: date
             * @description Period
             */
            period?: string;
            /**
             * Format: date
             * @description Due Date
             */
            due_date?: string;
            /**
             * Format: double
             * @description Amount
             */
            amount?: number;
            /**
             * Format: date-time
             * @description Operation Date
             */
            operation_date?: string;
            /**
             * Format: double
             * @description Balance at operation
             */
            balance?: number;
            /** @description currency */
            transaction__currency__display?: string;
            /** @description currency iso code */
            transaction__currency__iso_code?: string;
            /** @description bank order id */
            transaction__fonzip_id?: string;
        };
        MembershipDueDebts: {
            /** @description Due id */
            id?: number;
            /** @description Related user id */
            user_id?: number;
            /** @description Explanation for membership due record */
            details?: string;
            /**
             * Format: date
             * @description Period
             */
            period?: string;
            /**
             * @description debt status <br>
             *     - 1: Nonpaid debt <br>
             *     - 6: Removed/Inactive debt <br>
             *     - 8: Paid debt
             */
            status?: number;
            /**
             * Format: double
             * @description Debt amount
             */
            amount?: number;
            /**
             * Format: date-time
             * @description Operation Date
             */
            operation_date?: string;
            /** @description Related user name & surname */
            user__name?: string;
            /** @description users current balance amount */
            user__total_financial?: number;
            /** @description users membership number */
            user__membership_no?: number;
            /**
             * Format: date-time
             * @description Record creation timestamp
             */
            create_date?: string;
            /** @description User id who added the debt */
            added_by_id?: number | null;
            /** @description User name who added the debt */
            added_by__name?: string | null;
            /** @description Debt category id */
            debt_category_id?: number | null;
            /** @description Debt category name */
            debt_category__name?: string | null;
        };
        MembershipDues: {
            /** @description Due id */
            id?: number;
            /** @description Related user id */
            user_id?: number;
            /** @description Related user name & surname */
            user__name?: string;
            /** @description First name */
            first_name?: string;
            /** @description Last name */
            last_name?: string;
            /**
             * Format: email
             * @description Email Address
             */
            email?: string;
            /** @description Phone number */
            phone?: string;
            /** @description Explanation for membership due record */
            details?: string;
            /**
             * Format: date
             * @description Period
             */
            period?: string;
            /** @description Identity Number */
            tckno?: string;
            /** @description Transaction through Fonzip */
            transaction__fonzip_framework?: boolean;
            /**
             * Format: double
             * @description Dues amount
             */
            transaction__amount?: number;
            /**
             * Format: date-time
             * @description Operation Date
             */
            transaction__complete_date?: string;
            /**
             * @description Payment status <br>
             *     - 0: initialized <br>
             *     - 1: processing <br>
             *     - 2: 3d secure initialized <br>
             *     - 3: successful <br>
             *     - 4: refunded <br>
             *     - 5: failed <br>
             *     - 6: removed
             * @enum {integer}
             */
            transaction__payment_status?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
            transaction__payment_method?: components["schemas"]["PaymentMethod"];
            /** @description currency */
            transaction__currency__display?: string;
            /** @description currency iso code */
            transaction__currency__iso_code?: string;
            /** @description bank order id */
            transaction__fonzip_id?: string;
            /**
             * Format: date-time
             * @description refund date
             */
            transaction__refund_date?: string;
            /** @description error code */
            transaction__transaction_error__code?: string;
            /** @description error text */
            transaction__transaction_error__text?: string;
            transaction__transaction_error__group?: components["schemas"]["TransactionErrorGroup"];
        };
        UsersTickets: {
            /** @description Sold Ticket id */
            id?: number;
            /** @description Event id */
            event_id?: number;
            /**
             * Format: double
             * @description Transaction amount
             */
            transaction__amount?: number;
            /**
             * Format: date-time
             * @description Ticket sale date
             */
            transaction__complete_date?: string;
            /** @description Event name */
            event__name?: string;
            /** @description Users public ticket id parameter */
            transaction__fonzip_id_hashed?: string;
            /** @description Currency */
            transaction__currency__display?: number;
            /** @description Events url */
            event__url?: string;
        };
        UsersAnswers: {
            /** @description Answer id */
            id?: number;
            /**
             * Format: date-time
             * @description Answer date
             */
            complete_date?: string;
            /** @description Transaction id */
            transaction_id?: number;
            /**
             * Format: double
             * @description Transaction amount
             */
            transaction__amount?: number;
            /** @description Form id */
            custom_form_id?: number;
            /** @description Form title */
            custom_form__title?: string;
        };
        UsersEcardTransactions: {
            /** @description E-Card Transaction id */
            id?: number;
            /** @description E-Card id */
            certificate_id?: number;
            /** @description E-Card title */
            certificate__title?: string;
            /**
             * Format: double
             * @description Amount,
             */
            transaction__amount?: number;
            /** @description Currency */
            transaction__currency__display?: string;
            /** @description currency iso code */
            transaction__currency__iso_code?: string;
            /**
             * Format: date-time
             * @description Transaction date
             */
            transaction__complete_date?: string;
        };
        UserReference: {
            /** @description user id */
            id?: number;
            /**
             * Format: email
             * @description Email
             */
            email?: string;
            /** @description Cell Phone */
            phone?: string;
            /** @description first name and last name combined */
            name?: string;
            /** @description first name */
            first_name?: string;
            /** @description last name */
            last_name?: string;
            /** @description Identity Number */
            tckno?: string;
            /** @description profile pic url */
            profile_pic?: string;
            /** @description True if record is is set as corporate */
            corporate_type?: boolean;
            /** @description users membership number */
            membership_no?: number;
        };
        UserFormAnswerDetails: {
            /** @description user id */
            id?: number;
            /** @description name */
            name?: string;
            /** @description membership no */
            membership_no?: number;
        };
        UserDetails: {
            /** @description user id */
            id?: number;
            /** @description first name */
            first_name?: string;
            /** @description last name */
            last_name?: string;
            /** @description first name and last name combined */
            name?: string;
            /** @description nationality */
            nationality_text?: string | null;
            /** @description Identity Number */
            tckno?: string | null;
            /**
             * Format: date
             * @description Birthday
             */
            birthday?: string | null;
            /**
             * Format: email
             * @description Email
             */
            email?: string;
            /** @description Cell Phone */
            phone?: string;
            /** @description Home phone */
            home_phone_first?: string | null;
            /** @description Address */
            address?: string | null;
            /** @description Post code */
            post_code?: string | null;
            /** @description District */
            district_text?: string | null;
            /** @description City */
            city_text?: string | null;
            /** @description Country */
            country_text?: string | null;
            /** @description Work phone */
            work_phone?: string | null;
            /** @description Work address */
            work_address?: string | null;
            /** @description Work post code */
            work_post_code?: string | null;
            /** @description if users profile is private */
            private?: boolean;
            /** @description Work district */
            work_district_text?: string | null;
            /** @description Work city */
            work_city_text?: string | null;
            /** @description Work country */
            work_country_text?: string | null;
            /**
             * Format: email
             * @description second email
             */
            email_second?: string | null;
            /** @description users membership number */
            membership_no?: number;
            /** @description if user is admin or not */
            admin?: boolean;
            /** @description if record is a corporate or person */
            corporate_type?: boolean;
            /**
             * Format: date
             * @description users application date
             */
            apply_date?: string;
            /** @description if user has communication permission via phone */
            allow_comm_via_phone?: boolean;
            /**
             * Format: date-time
             * @description phone communication permission update date
             */
            allow_comm_via_phone_date?: string | null;
            /** @description if user has communication permission via sms */
            allow_comm_via_sms?: boolean;
            /**
             * Format: date-time
             * @description sms communication permission update date
             */
            allow_comm_via_sms_date?: string | null;
            /** @description if user has communication permission via email */
            allow_comm_via_email?: boolean;
            /**
             * Format: date-time
             * @description email communication permission update date
             */
            allow_comm_via_email_date?: string;
            /**
             * Format: date
             * @description users join date
             */
            join_date?: string;
            /** @description users current balance amount */
            total_financial?: number;
            /** @description user defined values as key value pairs. The key is the field's key (UserDefinedValues.value). A select field holds its chosen option. */
            user_defined_values?: {
                [key: string]: number | string | {
                    /** @description option id */
                    id: number;
                    /** @description options order */
                    order: number;
                    /** @description option text */
                    text: string;
                };
            };
            /**
             * Format: date-time
             * @description profile last update date
             */
            last_update_date?: string;
        };
        /** @description user defined values as key value pairs */
        UserDefinedValuesReference: {
            [key: string]: string | number | Record<string, unknown> | unknown[] | boolean;
        };
        UserDefinedValues: {
            /**
             * @description UDV id for display purposes, irrelevant for API
             * @example C12
             */
            id?: string;
            /**
             * @description UDV id
             * @example 12
             */
            udv_id?: number;
            /**
             * @description Field type, for display purposes, irrelevant for API
             * @default custom
             * @example custom
             */
            type: string;
            /** @description Field name */
            name?: string;
            /** @description Field key * */
            value?: string;
            /**
             * @description Key grouping, for display purposes, irrelevant for API
             * @default USER.GROUP.DEFINED_FIELDS
             * @example USER.GROUP.DEFINED_FIELDS
             */
            group: string;
            /**
             * @description User defined value type
             *     - 0: text
             *     - 1: paragraph
             *     - 2: number
             *     - 3: date
             *     - 4: year
             *     - 5: date-time
             *     - 6: boolean
             *     - 7: select
             *     - 8: multiple select
             * @enum {integer}
             */
            key_type?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
            /**
             * @description input type for key
             * @enum {string}
             */
            for?: "text" | "numeric" | "date" | "select" | "select_w_bool";
            options?: {
                /** @description option id */
                id?: number;
                /** @description option text */
                text?: string;
                /** @description options order */
                order?: number;
            }[];
            /** @description True text for boolean field */
            boolean_true_text?: string | null;
            /** @description False text for boolean field */
            boolean_false_text?: string | null;
            /** @description Select text for select and multiple select fields */
            select_text?: string | null;
            /** @description association type, for display purposes, irrelevant for API */
            display_for?: string;
            /** @description Limits of the field. Empty when the field has none. A text field can limit its length, a numeric field can cap its value. */
            validation?: {
                /** @description if the text length is limited */
                limit?: boolean;
                /** @description maximum text length */
                limit_value?: number;
                /** @description if the value has an upper bound */
                max?: boolean;
                /** @description maximum value */
                max_value?: number;
            };
        };
        Form: {
            /** @description form id */
            id?: number;
            /** @description form title */
            title?: string;
            /** @description form url */
            url?: string;
            /** @description form is active or not */
            active?: boolean;
            /** @description form order for listing on the site menu */
            order?: number;
            /** @description form is listed on the site menu or not */
            listing?: boolean;
            /**
             * Format: date-time
             * @description date of the last answer, null when the form was never answered
             */
            last_answer_date?: string | null;
            /** @description maximum number of applications the form accepts, null when unlimited */
            application_limit?: number | null;
            /** @description number for answers waiting for approval */
            waiting_approval?: number;
            /** @description total number of responses */
            response_count?: number;
            /**
             * Format: date-time
             * @description campaign create date
             */
            create_date?: string;
            /** @description Event created by user id */
            created_by_id?: number;
            /** @description Event created by user name */
            created_by__name?: string;
            /**
             * Format: date-time
             * @description last update date
             */
            update_date?: string;
            /** @description Event last updated by user id */
            updated_by_id?: number;
            /** @description Event last updated by user name */
            updated_by__name?: string;
            /** @description Event archived by user id */
            archived_by_id?: number;
            /** @description Event archived by user name */
            archived_by__name?: string;
            /**
             * Format: date-time
             * @description archive date
             */
            archive_date?: string;
        };
        FormAnswer: {
            /** @description form answer id */
            id?: number;
            /** @description first name */
            first_name?: string;
            /** @description lastname */
            last_name?: string;
            /**
             * Format: email
             * @description email
             */
            email?: string;
            /**
             * Format: date-time
             * @description answer date
             */
            complete_date?: string;
            /** @description User id */
            user_id?: number;
            /** @description transaction id */
            transaction_id?: number;
            /**
             * Format: double
             * @description payment amount
             */
            transaction__amount?: number;
            /** @description form id */
            custom_form_id?: number;
            /** @description Form title */
            custom_form__title?: string;
            /** @description error code ( only returned when `status=failed` ) */
            transaction__transaction_error__code?: string;
            /** @description error text ( only returned when `status=failed` ) */
            transaction__transaction_error__text?: string;
            transaction__transaction_error__group?: components["schemas"]["TransactionErrorGroup"];
        };
        EcardDetails: {
            /** @description ecard id */
            id?: number;
            /** @description ecard category id list */
            categories?: number[];
            /** @description ecard is available for sale in ecard apge */
            listing?: number;
            /** @description ecard is marked as starred status in ecard page */
            starred?: boolean;
            /** @description ecards payment system id */
            payment_settings_id?: number;
            /** @description minimum amount for ecard sale */
            minimum_amount?: number;
            /** @description ecard details */
            details?: string;
            /** @description ecard can be delivered via shipment to donors address */
            has_cargo?: boolean;
            /** @description ecard has fixed sale amount */
            has_fixed_amount?: boolean;
            /** @description minimum sale amount for shipment */
            minimum_cargo_amount?: number;
            /** @description ecards default amount for delivery page */
            first_amount?: number;
            /** @description ecards default amount for delivery page */
            second_amount?: number;
            /** @description ecards default amount for delivery page */
            third_amount?: number;
            /** @description ecards title */
            title?: string;
            /**
             * @description ecard type
             *     1: single
             *     2: in honor of someone
             *     3: in honor of someone with private message
             *     4: condolence
             *     5: condolence with private message
             */
            ecard_type?: number;
            /** @description ecard image url */
            image_file?: string;
            /** @description ecard preview url */
            preview_file?: number;
            /** @description ecard coordinate & preparation related parameters */
            first_image_x?: number;
            /** @description ecard coordinate & preparation related parameters */
            first_image_y?: number;
            /** @description ecard coordinate & preparation related parameters */
            first_image_width?: number;
            /** @description ecard coordinate & preparation related parameters */
            first_image_height?: number;
            /** @description ecard coordinate & preparation related parameters */
            font_color?: string;
            /** @description ecard coordinate & preparation related parameters */
            font_size?: string;
            /** @description ecard coordinate & preparation related parameters */
            font_family?: string;
            /** @description ecard coordinate & preparation related parameters */
            font_bold?: boolean;
            /** @description ecard coordinate & preparation related parameters */
            font_italic?: boolean;
            /** @description ecard coordinate & preparation related parameters */
            text_align?: number;
            /** @description ecard coordinate & preparation related parameters */
            second_image_x?: number;
            /** @description ecard coordinate & preparation related parameters */
            second_image_y?: number;
            /** @description ecard coordinate & preparation related parameters */
            second_image_width?: number;
            /** @description ecard coordinate & preparation related parameters */
            second_image_height?: number;
            /** @description ecard coordinate & preparation related parameters */
            second_text_align?: number;
            /** @description ecard coordinate & preparation related parameters */
            second_font_color?: string;
            /** @description ecard coordinate & preparation related parameters */
            second_font_size?: string;
            /** @description ecard coordinate & preparation related parameters */
            second_font_family?: string;
            /** @description ecard coordinate & preparation related parameters */
            second_font_bold?: boolean;
            /** @description ecard coordinate & preparation related parameters */
            second_font_italic?: boolean;
            /** @description ecard coordinate & preparation related parameters */
            third_image_x?: number;
            /** @description ecard coordinate & preparation related parameters */
            third_image_y?: number;
            /** @description ecard coordinate & preparation related parameters */
            third_image_width?: number;
            /** @description ecard coordinate & preparation related parameters */
            third_image_height?: number;
            /** @description ecard coordinate & preparation related parameters */
            third_text_align?: number;
            /** @description ecard coordinate & preparation related parameters */
            third_font_color?: string;
            /** @description ecard coordinate & preparation related parameters */
            third_font_size?: string;
            /** @description ecard coordinate & preparation related parameters */
            third_font_family?: string;
            /** @description ecard coordinate & preparation related parameters */
            third_font_bold?: boolean;
            /** @description ecard coordinate & preparation related parameters */
            third_font_italic?: boolean;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_image_x?: number;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_image_y?: number;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_image_width?: number;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_image_height?: number;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_font_color?: string;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_font_size?: string;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_font_family?: string;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_font_bold?: boolean;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_font_italic?: boolean;
            /** @description ecard coordinate & preparation related parameters */
            custom_message_text_align?: number;
            /** @description ecard is active or not */
            active?: boolean;
            /** @description ecards order in page */
            order?: number;
            /**
             * Format: date-time
             * @description ecards last update date
             */
            last_update_date?: string;
            /** @description mail template id to be sent when bought */
            thanks_mail_id?: number;
            /** @description mail template id to be sent to honoree when bought */
            referring_thanks_mail_id?: number;
            /** @description sms template id to be sent when bought */
            thanks_sms_id?: number;
            /** @description sms template id to be sent to honoree when bought */
            referring_thanks_sms_id?: number;
            /** @description ask billing info */
            ask_billing_info?: boolean;
            /** @description ecard background */
            background?: {
                /**
                 * @description background type, 0 for pattern, 1 for color, 2 for image
                 * @enum {integer}
                 */
                type?: 0 | 1 | 2;
                value?: string | number | Record<string, unknown>;
            };
        };
        FormAnswerDetails: {
            /** @description Form Answer ID */
            id?: number;
            transaction?: components["schemas"]["Transaction"];
            /**
             * Format: date-time
             * @description transaction date
             */
            complete_date?: string;
            user?: components["schemas"]["UserFormAnswerDetails"];
            /**
             * Format: email
             * @description E-mail address
             */
            email?: string;
            /** @description Verified Email */
            email_verification?: boolean;
            /** @description First name */
            first_name?: string;
            /** @description Last name */
            last_name?: string;
            /** @description Approval Status */
            approval_status?: number;
            /** @description Form answer details */
            form_answer_list?: components["schemas"]["FormAnswerDetail"][];
            sent_mail?: components["schemas"]["SentEmail"];
        };
        FormAnswerDetail: {
            /** @description Answer ID */
            id?: number;
            question?: components["schemas"]["FormQuestion"];
            /** @description Answer */
            answer?: string;
            /** @description Answer in Database */
            db_answer?: string;
            /** @description Chosen options */
            selected_option_list?: components["schemas"]["SelectedOptionDetail"][];
        };
        FormQuestion: {
            /** @description Question ID */
            id?: number;
            /** @description Question Text */
            title?: string;
            /** @description Question Slug */
            slug?: string;
            /** @description Question order */
            order?: number;
            /**
             * @description Question type
             *     - 0: Static
             *     - 1: User Defined Fields
             *     - 2: Custom question
             *     - 3: Explanation field
             * @enum {integer}
             */
            question_type?: 0 | 1 | 2 | 3;
            /** @description required */
            required?: boolean;
            /** @description additional information */
            information?: string;
            /**
             * @description Static Question ID
             *     - 1: phone
             *     - 2: Identity Number
             *     - 30: District
             *     - 31: City
             *     - 32: Country
             *     - 33: Address
             *     - 34: Zip/Post Code
             *     - 4: Birthday
             *     - 6: Nationality
             *     - 7: secondary email
             *     - 40: work District
             *     - 41: work City
             *     - 42: work Country
             *     - 43: work Address
             *     - 44: work Zip/Post Code
             *     - 8: work phone
             *     - 9: home phone
             *     - 10: profile photo
             * @enum {integer}
             */
            static_question?: 1 | 2 | 30 | 31 | 32 | 33 | 34 | 4 | 6 | 7 | 40 | 41 | 42 | 43 | 44 | 8 | 9 | 10;
            udv_question?: components["schemas"]["UserDefinedValues"];
            custom_question?: components["schemas"]["CustomQuestion"];
            /**
             * @description True when the question has been deleted from the form. Answers given before
             *     the deletion are kept and still returned. A deleted question built on a custom
             *     field that was deleted too has no `udv_question`.
             */
            deleted?: boolean;
        };
        SelectedOptionDetail: {
            /** @description Option ID */
            id?: number;
            /** @description Option text */
            text?: string;
            /** @description Option order */
            order?: number;
        };
        CustomQuestion: {
            /** @description Question type ID */
            id?: number;
            /** @description Question type */
            name?: string;
            /**
             * @description Question type slug
             * @enum {string}
             */
            short?: "text" | "select" | "multiple" | "boolean";
        };
        /**
         * @description A single row of the `/ecard-transactions` list. Which properties are
         *     present depends on the `status` and `list` query parameters - see the
         *     endpoint description. Fields the request did not ask for are omitted
         *     from the object entirely rather than returned as `null`.
         */
        EcardTransaction: {
            /** @description e-card transaction id */
            id?: number;
            /** @description user id */
            user_id?: number;
            /** @description first name */
            first_name?: string;
            /** @description last name */
            last_name?: string;
            /**
             * Format: email
             * @description email
             */
            email?: string;
            /** @description phone */
            phone?: string;
            /**
             * @description cargo status of the transaction
             *     - 0: will not be sent
             *     - 1: waiting to be prepared
             *     - 2: waiting for cargo info
             *     - 3: posted
             * @enum {integer}
             */
            cargo_status?: 0 | 1 | 2 | 3;
            /** @description cargo tracking number */
            cargo_number?: string;
            /** @description cargo company */
            cargo_company?: string;
            /** @description number of recipients of this e-card transaction */
            recipient_count?: number;
            /**
             * Format: url
             * @description certificate file url
             */
            certificate_file?: string;
            /**
             * Format: url
             * @description url of the ZIP archive containing every certificate file, produced
             *     for transactions with more than one recipient
             */
            zip_file?: string;
            /** @description certificate id */
            certificate_id?: number;
            /** @description certificate title */
            certificate__title?: string;
            /**
             * Format: double
             * @description Ecard transaction amount
             */
            transaction__amount?: number;
            /** @description currency */
            transaction__currency__display?: string;
            /** @description currency iso code */
            transaction__currency__iso_code?: string;
            /** @description transaction through fonzip */
            transaction__fonzip_framework?: boolean;
            /**
             * @description Payment status <br>
             *     - 0: initialized <br>
             *     - 1: processing <br>
             *     - 2: 3d secure initialized <br>
             *     - 3: successful <br>
             *     - 4: refunded <br>
             *     - 5: failed <br>
             *     - 6: removed
             * @enum {integer}
             */
            transaction__payment_status?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
            transaction__payment_method?: components["schemas"]["PaymentMethod"];
            /**
             * Format: date-time
             * @description transaction date
             */
            transaction__complete_date?: string;
            /** @description transactions payment system id */
            transaction__payment_settings_id?: number;
            /** @description transactions payment system name */
            transaction__payment_settings__name?: string;
            /** @description transactions bank account id */
            transaction__bank_account_id?: number;
            /** @description transactions bank account name */
            transaction__bank_account__name?: string;
            /**
             * Format: date-time
             * @description refund date ( only returned when `status=refund` )
             */
            transaction__refund_date?: string;
            /** @description refund reason ( only returned when `status=refund` ) */
            transaction__refund_reason?: string;
            /** @description id of the user who refunded ( only returned when `status=refund` ) */
            transaction__refunded_by_id?: number;
            /** @description name of the user who refunded ( only returned when `status=refund` ) */
            transaction__refunded_by__name?: string;
            /** @description error code ( only returned when `status=failed` ) */
            transaction__transaction_error__code?: string;
            /** @description error text ( only returned when `status=failed` ) */
            transaction__transaction_error__text?: string;
            transaction__transaction_error__group?: components["schemas"]["TransactionErrorGroup"];
            /** @description mail sytem id */
            sent_mail_id?: number;
            /** @description mail message id */
            sent_mail__message_id?: number;
            /** @description mail status */
            sent_mail__status?: number;
            /** @description mail sytem id */
            sent_mail_to_referring_id?: number;
            /** @description referring mail message id */
            sent_mail_to_referring__message_id?: number;
            /** @description referring mail status */
            sent_mail_to_referring__status?: number;
            /** @description bank transaction id */
            transaction__transaction_id?: string;
            /** @description bank provision no */
            transaction__provision_no?: string;
            /** @description transactions IP address */
            transaction__ip_address?: string;
            /** @description Receipt No for ecard transaction */
            transaction__receipt_no?: string;
            /** @description bank order id */
            transaction__fonzip_id?: string;
            /** @description User id who added ecard transaction */
            added_by_id?: number;
            /** @description User name who added ecard transaction */
            added_by__name?: string;
            /** @description Card BIN Number */
            transaction__bin_number?: string;
            /** @description Card last for */
            transaction__last_four?: string;
            /**
             * @description card delivery time.
             *     - 0: send immediately
             *     - 1: send at specific date for all recipients
             *     - 2: send at different dates for all recipients
             * @enum {integer}
             */
            delivery_time_mode?: 0 | 1 | 2;
            /**
             * Format: date
             * @description Scheduled delivery date of the e-card. `null` when
             *     `delivery_time_mode` is 0 (immediate). With
             *     `delivery_time_mode` 2 each recipient carries its own
             *     `delivery_date` inside `recipient_list`.
             */
            delivery_date?: string;
            /** @description allow communication via phone */
            news_via_phone?: boolean;
            /** @description allow communication via sms */
            news_via_sms?: boolean;
            /** @description allow communication via email */
            news_via_email?: boolean;
            /** @description multiple recipient details list */
            recipient_list?: {
                /** @description recipient index number */
                index?: number;
                /** @description recipient name */
                name?: string;
                /**
                 * Format: email
                 * @description recipient email
                 */
                email?: string;
                /** @description recipient phone */
                phone?: string;
                /** @description recipient address */
                address?: string;
                /** @description recipient city */
                city?: string;
                /** @description recipient district */
                district?: string;
                /** @description recipient custom message for e-card transaction */
                custom_message?: string;
                /**
                 * Format: date
                 * @description the date printed on this recipient's certificate image,
                 *     for e-card types that carry a date
                 */
                ecard_date?: string;
                /**
                 * Format: date
                 * @description this recipient's own delivery date, present when the
                 *     transaction's `delivery_time_mode` is 2
                 */
                delivery_date?: string;
                /** @description recipient cargo tracking number */
                cargo_number?: string;
                /** @description recipient cargo company */
                cargo_company?: string;
                /**
                 * @description cargo status
                 *     - 0: wont sent
                 *     - 1: waiting to be prepared
                 *     - 2: waiting for cargo info
                 *     - 3: delivered
                 * @enum {number}
                 */
                cargo_status?: 0 | 1 | 2 | 3;
                /**
                 * Format: url
                 * @description recipient certificate file url
                 */
                file?: string;
                /** @description recipient mail message id */
                mail_message_id?: number;
                /** @description recipient mail system id */
                sent_mail_id?: number;
                /** @description recipient mail status */
                mail_status?: number;
            }[];
            /**
             * @description billing type
             *     0: no bill
             *     1: personal
             *     2: corporate
             * @enum {integer}
             */
            bill_type?: 0 | 1 | 2;
            /** @description billing name */
            billing_name?: string;
            /** @description tax info */
            tax_info?: string;
            /** @description billing address */
            billing_address?: string;
            /** @description billing district */
            billing_district?: string;
            /** @description billing city */
            billing_city?: string;
            /** @description delivery address */
            address?: string;
            /** @description delivery city */
            city?: string;
            /** @description delivery district */
            district?: string;
            /** @description True if e-card is for an honoree */
            referring?: boolean;
            /** @description third name for e-card transaction (baby, deceised name) */
            third_name?: string;
            /** @description honoree's name & surname */
            referring_name?: string;
            /** @description honoree's phone */
            referring_phone?: string;
            /** @description honoree's email */
            referring_email?: string;
            /** @description e-card transaction language */
            language?: string;
            /**
             * @description donor type
             *     - 1: person
             *     - 2: corporate
             * @enum {number}
             */
            donor_type?: 1 | 2;
            /**
             * @description delivery address
             *     - 0: address of donor
             *     - 1: address of honoree
             *     - 2: other
             * @enum {number}
             */
            delivery_to?: 0 | 1 | 2;
            /** @description delivery name */
            delivery_to_name?: string;
            /** @description custom message for e-card transaction */
            custom_message?: string;
            /** @description e-card is available for printed delivery with cargo */
            has_cargo?: boolean;
            /** @description e-card will be delivered via mail */
            deliver_as_mail?: boolean;
            /** @description e-card will be delivered via cargo */
            deliver_as_cargo?: boolean;
            /**
             * Format: date
             * @description The date printed on the certificate image (anniversary, birth date,
             *     commemoration date, …). `null` for e-card types that carry no date.
             *     This is not the delivery date - see `delivery_date` for that.
             */
            ecard_date?: string;
            /** @description names of the categories the e-card belongs to */
            certificate__categories__name?: string[];
            /** @description UTM source ( `null` for organic / direct traffic ) */
            marketing_channel__utm_source?: string;
            /** @description UTM medium ( `null` for organic / direct traffic ) */
            marketing_channel__utm_medium?: string;
            /** @description UTM campaign ( `null` for organic / direct traffic ) */
            marketing_channel__utm_campaign?: string;
            /** @description UTM content ( `null` for organic / direct traffic ) */
            marketing_channel__utm_content?: string;
        };
        EcardTransactionDetail: {
            /** @description E-Card Transaction id */
            id?: number;
            /** @description user id */
            user_id?: number;
            /**
             * Format: url
             * @description certificate file url
             */
            certificate_file?: string;
            /** @description first name */
            first_name?: string;
            /** @description last name */
            last_name?: string;
            /**
             * Format: email
             * @description email
             */
            email?: string;
            /** @description phone */
            phone?: string;
            /** @description address */
            address?: string;
            /** @description city */
            city?: string;
            /** @description district */
            district?: string;
            /** @description True if certificate is for an honoree */
            referring?: boolean;
            /** @description honoree's name & surname */
            referring_name?: string;
            /** @description honoree's phone */
            referring_phone?: string;
            /** @description honoree's email */
            referring_email?: string;
            /**
             * @description delivery address
             *     - 0: address of donor
             *     - 1: address of honoree
             *     - 2: other
             * @enum {number}
             */
            delivery_to?: 0 | 1 | 2;
            /** @description delivery name */
            delivery_to_name?: string;
            /** @description True if certificate will be posted */
            deliver_as_cargo?: boolean;
            /**
             * @description cargo status
             *     - 0: wont sent
             *     - 1: waiting to be prepared
             *     - 2: waiting for cargo info
             *     - 3: delivered
             * @enum {number}
             */
            cargo_status?: 0 | 1 | 2 | 3;
            /**
             * @description donor type
             *     - 1: person
             *     - 2: corporate
             * @enum {number}
             */
            donor_type?: 1 | 2;
            /** @description cargo tracking number */
            cargo_number?: string;
            /** @description cargo company */
            cargo_company?: string;
            /** @description mail status */
            sent_mail__status?: number;
            /** @description referring mail id */
            sent_mail_to_referring__message_id?: number;
            /** @description Certificate id */
            certificate_id?: number;
            /** @description Certificate title */
            certificate__title?: string;
            /** @description payment system name */
            transaction__payment_settings__name?: string;
            /** @description payment currency */
            transaction__currency__display?: string;
            /** @description E-Card Transaction amount */
            transaction__amount?: number;
            /**
             * @description Payment status <br>
             *     - 0: initialized <br>
             *     - 1: processing <br>
             *     - 2: 3d secure initialized <br>
             *     - 3: successful <br>
             *     - 4: refunded <br>
             *     - 5: failed <br>
             *     - 6: removed
             * @enum {integer}
             */
            transaction__payment_status?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
            /** @description error text */
            transaction__transaction_error__text?: string;
            /** @description Card BIN Number */
            transaction__bin_number?: string;
            /**
             * Format: date-time
             * @description refund date
             */
            transaction__refund_date?: string;
            /** @description bank order id */
            transaction__fonzip_id?: string;
            /** @description bank provision no */
            transaction__provision_no?: string;
            /** @description Transaction through Fonzip */
            transaction__fonzip_framework?: boolean;
            /** @description certificate is available for printed delivery with cargo */
            certificate__has_cargo?: boolean;
            transaction__payment_method?: components["schemas"]["PaymentMethod"];
            /** @description Users name who added E-Card transaction */
            added_by__name?: string;
            /** @description User id who refunded E-Card transaction */
            transaction__refunded_by_id?: number;
            /** @description Users name who refunded E-Card transaction */
            transaction__refunded_by__name?: string;
            /** @description User id who last updated E-Card transaction */
            updated_by_id?: number;
            /** @description Users name who last updated E-Card transaction */
            updated_by__name?: string;
            /**
             * Format: date-time
             * @description last update date of E-Card transaction
             */
            last_update_date?: string;
        };
        Webhook: {
            /** @description Webhook Id */
            id?: number;
            /** @description Webhook Name */
            name: string;
            /**
             * Format: uri
             * @description Webhook URL
             */
            url: string;
            /** @description True if authentication header is set */
            authentication?: boolean;
            /** @description basic authentication header value */
            auth_token?: string;
            events: {
                /** @description subscribe to donations */
                DONATION?: boolean;
                /** @description subscribe to membership dues */
                SUBSCRIPTION?: boolean;
                /** @description subscribe to ticket sales */
                TICKET?: boolean;
                /** @description subscribe to form answers */
                FORM?: boolean;
                /** @description subscribe to E-Card transactions */
                CERTIFICATE_SALE?: boolean;
                /** @description subscribe to fundraising campaigns */
                FUNDRAISING_CAMPAIGN?: boolean;
            };
        };
        /** @enum {string} */
        DonationPageListOrder: "order" | "title" | "-title" | "last_donation_date" | "-last_donation_date";
        /** @enum {string} */
        FormListOrder: "order" | "title" | "-title" | "response_count" | "-response_count" | "waiting_approval" | "-waiting_approval" | "last_answer_date" | "-last_answer_date";
        /** @enum {string} */
        EcardTransactionListOrder: "transaction__complete_date" | "-transaction__complete_date" | "transaction__amount" | "-transaction__amount" | "transaction__refund_date" | "-transaction__refund_date" | "id" | "-id" | "first_name" | "-first_name" | "last_name" | "-last_name" | "email" | "-email" | "phone" | "-phone" | "birthday" | "-birthday" | "city" | "-city" | "district" | "-district" | "address" | "-address" | "donor_type" | "-donor_type" | "language" | "-language" | "cargo_status" | "-cargo_status" | "cargo_number" | "-cargo_number" | "cargo_company" | "-cargo_company" | "has_cargo" | "-has_cargo" | "deliver_as_mail" | "-deliver_as_mail" | "deliver_as_cargo" | "-deliver_as_cargo" | "delivery_to" | "-delivery_to" | "delivery_to_name" | "-delivery_to_name" | "delivery_date" | "-delivery_date" | "delivery_time_mode" | "-delivery_time_mode" | "ecard_date" | "-ecard_date" | "recipient_count" | "-recipient_count" | "recipient_list" | "-recipient_list" | "custom_message" | "-custom_message" | "referring" | "-referring" | "third_name" | "-third_name" | "referring_name" | "-referring_name" | "referring_email" | "-referring_email" | "referring_phone" | "-referring_phone" | "bill_type" | "-bill_type" | "billing_name" | "-billing_name" | "tax_info" | "-tax_info" | "billing_address" | "-billing_address" | "billing_district" | "-billing_district" | "billing_city" | "-billing_city" | "news_via_phone" | "-news_via_phone" | "news_via_sms" | "-news_via_sms" | "news_via_email" | "-news_via_email" | "last_update_date" | "-last_update_date" | "certificate_id" | "-certificate_id" | "transaction_id" | "-transaction_id" | "user_id" | "-user_id" | "association_id" | "-association_id" | "added_by_id" | "-added_by_id" | "updated_by_id" | "-updated_by_id" | "sent_mail_id" | "-sent_mail_id" | "sent_mail_to_referring_id" | "-sent_mail_to_referring_id" | "marketing_channel_id" | "-marketing_channel_id" | "agreements" | "-agreements";
        /** @enum {string} */
        EcardTransactionListField: "ecard" | "amount" | "email_status" | "complete_date" | "payment_method" | "fonzip_id" | "transaction_id" | "provision_no" | "receipt_no" | "ip_address" | "payment_settings_id" | "payment_settings__name" | "bank_account_id" | "bank_account__name" | "added_by_id" | "card_number" | "delivery_date" | "news_via_phone" | "news_via_sms" | "news_via_email" | "recipient_list" | "bill_type" | "billing_name" | "tax_info" | "billing_address" | "billing_district" | "billing_city" | "address" | "city" | "district" | "referring" | "third_name" | "referring_name" | "referring_email" | "referring_phone" | "language" | "donor_type" | "delivery_to" | "delivery_to_name" | "custom_message" | "has_cargo" | "deliver_as_mail" | "deliver_as_cargo" | "ecard_date" | "category" | "marketing_channel__utm_source" | "marketing_channel__utm_medium" | "marketing_channel__utm_campaign" | "marketing_channel__utm_content";
    };
    responses: {
        /** @description Operation successful */
        EmptyResult: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": Record<string, unknown>;
            };
        };
        /** @description Fundraising team created successfully */
        CreateUpdateFundraisingTeamCampaignResult: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /**
                     * @description create campaign result
                     * @enum {string}
                     */
                    result?: "ok";
                    campaign?: {
                        /** @description Fundraising team campaign id */
                        id?: number;
                        /** @description Fundraising team campaign is currently active & default */
                        default?: boolean;
                        /** @description Fundraising teams' campaign title */
                        title?: string;
                        /** @description true if campaign has target */
                        has_target?: boolean;
                        /** @description campaign target */
                        target?: number;
                        /** @description campaign target currency id */
                        target_currency_id?: number;
                        /** @description campaign target currency display */
                        target_currency__display?: string;
                    };
                };
            };
        };
        /** @description Fundraising team created successfully */
        CreateFundraisingTeamResult: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "team_id": 1
                 *     }
                 */
                "application/json": {
                    /** @description Fundraising team id */
                    team_id?: number;
                };
            };
        };
        /** @description Fundraising team detail fetched successfully */
        FundraisingTeamDetailResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    team?: {
                        /** @description fundraising team id */
                        id?: number;
                        /** @description fundraising team owner id */
                        user_id?: number;
                        /** @description fundraising team owner full name */
                        user__name?: string;
                        /** @description fundraising team title */
                        title?: string;
                        /** @description fundraising team image url */
                        image?: string;
                        /** @description fundraising team detail */
                        details?: string;
                        /** @description fundraising team url */
                        slug?: string;
                        /** @description fundraising team default currency id */
                        currency_id?: string;
                        /** @description fundraising team currency value compared to TRY */
                        currency__value?: string;
                        /** @description fundraising team currency display */
                        currency__display?: string;
                        /**
                         * @description fundraising team status
                         *     - 0: waiting approval
                         *     - 1: approved
                         *     - 2: rejected
                         *     - 3: waiting extra approval
                         *     - 4: deleted
                         *     - 5: archived
                         * @enum {integer}
                         */
                        status?: 0 | 1 | 2 | 3 | 4 | 5;
                        /** @description fundraising team updated title waiting for approval */
                        update_title?: string;
                        /** @description fundraising team updated details waiting for approval */
                        update_details?: string;
                        /** @description fundraising team updated image waiting for approval */
                        update_image?: string;
                        /**
                         * Format: double
                         * @description donation sum
                         */
                        donation_sum?: number;
                        /** @description donation count */
                        donation_count?: number;
                        campaign_list?: components["schemas"]["FundraisingTeamCampaignList"][];
                    };
                };
            };
        };
        /** @description Access token generated successfully */
        GenerateToken: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "access_token": "access_token",
                 *       "token_type": "Bearer",
                 *       "expires_in": 3600,
                 *       "refresh_token": "refresh_token"
                 *     }
                 */
                "application/json": {
                    /** @description Access token to be used */
                    access_token?: string;
                    /** @description Access token type */
                    token_type?: string;
                    /** @description Number of seconds to token expiration */
                    expires_in?: number;
                    /** @description Refresh token used to obtain a new access token. Valid for 30 days, on a sliding window: each refresh returns a new refresh token and starts a fresh 30 days, so the previous one stops working. Only returned for the authorization_code grant. */
                    refresh_token?: string;
                };
            };
        };
        /** @description Invalid Credentials */
        InvalidCredentials: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "invalid_client",
                 *       "error_description": "Unauthorized Access"
                 *     }
                 */
                "application/json": {
                    /** @description Oauth error type */
                    error?: string;
                    /** @description Oauth error description */
                    error_description?: string;
                };
            };
        };
        /** @description Not a valid account */
        InvalidGrant: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "invalid_grant",
                 *       "error_description": "Your account is not authorized to use the fonzip API"
                 *     }
                 */
                "application/json": {
                    /** @description Oauth error type */
                    error?: string;
                    /** @description Oauth error description */
                    error_description?: string;
                };
            };
        };
        /** @description Invalid Request Method */
        InvalidRequestMethod: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "invalid_request",
                 *       "error_description": "Invalid Request"
                 *     }
                 */
                "application/json": {
                    /** @description Oauth error type */
                    error?: string;
                    /** @description Oauth error description */
                    error_description?: string;
                };
            };
        };
        /** @description The authorization code or refresh token presented is not usable - unknown, already exchanged, past its expiry, or issued for a different redirect_uri. Authorization codes are single use: exchange each one exactly once and keep the refresh token. */
        InvalidAuthorizationGrant: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "invalid_grant",
                 *       "error_description": "Invalid authorization code"
                 *     }
                 */
                "application/json": {
                    /** @description Oauth error type */
                    error?: string;
                    /** @description Oauth error description */
                    error_description?: string;
                };
            };
        };
        /** @description Access token generation failed */
        GrantTypeError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "unsupported_grant_type",
                 *       "error_description": "Invalid grant_type parameter"
                 *     }
                 */
                "application/json": {
                    /** @description Oauth error type */
                    error?: string;
                    /** @description Oauth error description */
                    error_description?: string;
                };
            };
        };
        /** @description Rate limit exceeded */
        RateLimitExceeded: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Rate limit exceeded message */
                    error?: string;
                };
            };
        };
        /** @description Generate Token Fail */
        GenerateTokenFail: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "invalid_request",
                 *       "error_description": "Unexpected error, please contact us."
                 *     }
                 */
                "application/json": {
                    /** @description Oauth error type */
                    error?: string;
                    /** @description Oauth error description */
                    error_description?: string;
                };
            };
        };
        /** @description List User Response */
        GetUserListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "user_list": [
                 *         {
                 *           "id": 1546,
                 *           "name": "Mehmet Ali",
                 *           "email": "mehmet@ali.com",
                 *           "phone": "0555 555 5555",
                 *           "tckno": null,
                 *           "membership_no": 20,
                 *           "total_financial": 50
                 *         },
                 *         {
                 *           "id": 7435,
                 *           "name": "Mehmet Veli",
                 *           "email": "mehmet@veli.com",
                 *           "phone": "0535 535 5555",
                 *           "tckno": "35434635453",
                 *           "membership_no": 564,
                 *           "total_financial": 200
                 *         }
                 *       ],
                 *       "total": 2
                 *     }
                 */
                "application/json": {
                    user_list?: components["schemas"]["User"][];
                    /** @description Total number of users matching criteria */
                    total?: number;
                };
            };
        };
        /** @description Association information */
        GetMeResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["AssociationInfo"];
            };
        };
        /** @description Users timeline is listed successfully */
        GetUsersTimelineResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    timeline?: components["schemas"]["Timeline"][];
                    /** @description Total number of timeline events */
                    total?: number;
                };
            };
        };
        /** @description Users tags are listed successfully */
        GetUsersTagListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    tags?: components["schemas"]["Tag"][];
                };
            };
        };
        /** @description Donations are listed successfully */
        DonationListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    donation_list?: components["schemas"]["DonationResult"][];
                    /** @description Total number of donations */
                    total?: number;
                };
            };
        };
        /** @description Donations pages are listed successfully */
        DonationPageListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description ok */
                    result?: string;
                    page_list?: components["schemas"]["DonationPageList"][];
                    /** @description Total number of donation pages */
                    total?: number;
                };
            };
        };
        /** @description Donations forms are listed successfully */
        DonationFormListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    form_list?: components["schemas"]["DonationFormList"][];
                    /** @description Total number of donation forms */
                    total?: number;
                };
            };
        };
        /** @description Donations details fetched successfully */
        DonationDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    donation?: components["schemas"]["DonationDetailResult"];
                };
            };
        };
        /** @description Donations are listed successfully */
        UsersDonationListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    donation_list?: components["schemas"]["UsersDonation"][];
                    /** @description Total number of donations */
                    total?: number;
                };
            };
        };
        /** @description Donations are listed successfully */
        UsersMonthlyDonationListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    recurring?: components["schemas"]["UsersMonthlyDonation"][];
                };
            };
        };
        /** @description Users membership dues are listed successfully */
        UsersMembershipDuesResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    subscription_list?: components["schemas"]["UsersMembershipDues"][];
                    /** @description Total number of membership dues */
                    total?: number;
                };
            };
        };
        /** @description Membership dues debts are listed successfully */
        MembershipDueDebtListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    debt_list?: components["schemas"]["MembershipDueDebts"][];
                    /** @description Total number of membership dues */
                    total?: number;
                };
            };
        };
        /** @description Membership dues are listed successfully */
        MembershipDuesListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    subscription_list?: components["schemas"]["MembershipDues"][];
                    /** @description Total number of membership dues */
                    total?: number;
                };
            };
        };
        /** @description Users tickets are listed successfully */
        TicketListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    bought_ticket_list?: components["schemas"]["UsersTickets"][];
                    /** @description Total number of Tickets */
                    total?: number;
                };
            };
        };
        /** @description Answers are listed successfully */
        FormAnswerListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    answer_list?: components["schemas"]["FormAnswer"][];
                    /** @description Total number of Form Answers */
                    total?: number;
                };
            };
        };
        /** @description Users answers are listed successfully */
        UsersFormAnswerListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    answer_list?: components["schemas"]["UsersAnswers"][];
                    /** @description Total number of FormAnswers */
                    total?: number;
                };
            };
        };
        /** @description Users certificates are listed successfully */
        UserEcardTransactionListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    sale_list?: components["schemas"]["UsersEcardTransactions"][];
                    /** @description Total number of Certificates */
                    total?: number;
                };
            };
        };
        /** @description Login link is generated */
        LoginLinkResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Login link */
                    link?: string;
                };
            };
        };
        /** @description Users details are returned successfully */
        UserDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    user?: components["schemas"]["UserDetails"];
                };
            };
        };
        /** @description User defined values are listed successfully */
        UserDefinedListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description User Defined Value List */
                    udv_list?: components["schemas"]["UserDefinedValues"][];
                };
            };
        };
        /** @description Tags are listed successfully */
        TagListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    tag_list?: components["schemas"]["Tag"][];
                    /** @description Total number of Tags */
                    total?: number;
                };
            };
        };
        /** @description Membership Due Details are listed successfully */
        MembershipDueDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    subscription?: components["schemas"]["MembershipDueDetails"];
                };
            };
        };
        /** @description Debt Details are listed successfully */
        DebtDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    subscription?: components["schemas"]["MembershipDueDetails"];
                };
            };
        };
        /** @description Debt created successfully */
        CreateDebtSuccess: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "debt_id": 812345
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    /** @description created debt id */
                    debt_id?: number;
                    /** @description The payment's id, with add_payment */
                    subscription_id?: number;
                    /**
                     * Format: double
                     * @description The payment's amount, with add_payment
                     */
                    amount?: number;
                    /** @description The payment's currency, with add_payment */
                    currency?: string;
                };
            };
        };
        /**
         * @description The debt, or its payment, could not be recorded. `debt_id` is there only when the debt
         *     was written before its payment failed.
         */
        CreateDebtFailed: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Operation Fail Reason */
                    error?: string;
                    /** @description The debt that was written before the payment failed */
                    debt_id?: number;
                };
            };
        };
        /** @description Debt categories are listed successfully */
        DebtCategoryListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    category_list?: components["schemas"]["DebtCategoryListItem"][];
                    /** @description Total number of categories */
                    total?: number;
                };
            };
        };
        /** @description Debt category saved successfully */
        DebtCategoryResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "category": {
                 *         "id": 12,
                 *         "name": "Aidat",
                 *         "deleted": false
                 *       }
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    category?: components["schemas"]["DebtCategory"];
                };
            };
        };
        /** @description What deleting the category would move */
        DebtCategoryUsageResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["DebtCategoryUsage"];
            };
        };
        /** @description Debt category deleted, after moving what used it */
        DebtCategoryDeleteResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description ok */
                    result?: string;
                    /** @description Debts moved, of every state */
                    debt_count?: number;
                    /** @description Add-debt automations moved */
                    automation_count?: number;
                    /** @description The category they moved to; null for none */
                    replacement_name?: string | null;
                };
            };
        };
        /**
         * @description The category is in use and no `replacement_id` was sent, or a move involving it is
         *     not finished.
         */
        DebtCategoryInUse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Operation Fail Reason */
                    error?: string;
                    usage?: components["schemas"]["DebtCategoryUsage"];
                };
            };
        };
        /** @description Payment systems are listed successfully */
        PaymentSystemListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    payment_settings_list?: components["schemas"]["PaymentSettings"][];
                    /** @description Total number of PaymentSystems */
                    total?: number;
                };
            };
        };
        /** @description Bank accounts are listed successfully */
        BankAccountListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    account_list?: components["schemas"]["BankAccount"][];
                    /** @description Total number of Bank Accounts */
                    total?: number;
                };
            };
        };
        /** @description Bank account transactions are listed successfully */
        BankAccountTransactionListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    transaction_list?: components["schemas"]["BankAccountTransaction"][];
                    /** @description Total number of transactions matching the filters */
                    total?: number;
                };
            };
        };
        /** @description Marketing channels are listed successfully */
        MarketingChannelListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    channel_list?: components["schemas"]["MarketingChannel"][];
                    /** @description Total number of Marketing Channels */
                    total?: number;
                };
            };
        };
        /** @description Distinct UTM values per field */
        MarketingChannelFilterValuesResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Distinct utm_source values seen for this association */
                    sources?: string[];
                    /** @description Distinct utm_medium values seen for this association */
                    mediums?: string[];
                    /** @description Distinct utm_campaign values seen for this association */
                    campaigns?: string[];
                    /** @description Distinct utm_content values seen for this association */
                    contents?: string[];
                };
            };
        };
        /** @description Donation categories are listed successfully */
        DonationCategoryListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    category_list?: components["schemas"]["DonationCategory"];
                    /** @description Total number of categories */
                    total?: number;
                };
            };
        };
        /** @description Ecard categories are listed successfully */
        EcardCategoryListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    category_list?: components["schemas"]["EcardCategory"];
                    /** @description Total number of categories */
                    total?: number;
                };
            };
        };
        /** @description Events are listed successfully */
        EventListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    event_list?: components["schemas"]["EventList"][];
                    /** @description Total number of Events */
                    total?: number;
                };
            };
        };
        /** @description Event details are listed successfully */
        EventDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    event?: components["schemas"]["Event"];
                };
            };
        };
        /** @description Ticket details are listed successfully */
        EventTicketDetail: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    ticket?: components["schemas"]["EventTicket"];
                };
            };
        };
        /** @description Ticket sales are listed successfully */
        TicketSaleListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    sales_list?: components["schemas"]["TicketSale"][];
                    /** @description Total number of TicketSales */
                    total?: number;
                };
            };
        };
        /** @description Ticket Details are listed successfully */
        TicketDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    ticket_sale?: components["schemas"]["TicketSale"];
                };
            };
        };
        /** @description Fundraising campaigns are listed successfully */
        FundraisingCampaignListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    campaign_list?: components["schemas"]["FundraisingCampaignList"][];
                    /** @description Total number of FundraisingCampaigns */
                    total?: number;
                };
            };
        };
        /** @description Fundraising Campaign Details are listed successfully */
        FundraisingCampaignDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    campaign?: {
                        /** @description fundraising campaign id */
                        id?: number;
                        /** @description user id */
                        user_id?: number;
                        /** @description users first name */
                        user__first_name?: string;
                        /** @description users last name */
                        user__last_name?: string;
                        /** @description users profile picture url */
                        user__profile_pic?: string;
                        /**
                         * Format: date-time
                         * @description campaign create date
                         */
                        create_date?: string;
                        /**
                         * Format: date-time
                         * @description campaign activation date
                         */
                        activation_date?: string;
                        /**
                         * Format: date-time
                         * @description campaign finalize date
                         */
                        finish_date?: string;
                        /** @description campaign title */
                        title?: string;
                        /** @description campaign url exception */
                        url?: string;
                        /** @description campaign image url */
                        image?: string;
                        /** @description campaigns message */
                        personal_message?: string;
                        /** @description users message to ngo */
                        user_note?: string;
                        /** @description true if campaign has target */
                        has_target?: boolean;
                        /** @description true if total donation is hidden in campaign */
                        hide_total_donation?: boolean;
                        /** @description true if donor list is hidden in campaign */
                        hide_donor_list?: boolean;
                        /** @description campaign target */
                        target?: number;
                        /**
                         * @description campaign status
                         *     - 0: waiting approval
                         *     - 1: approved
                         *     - 2: rejected
                         *     - 3: finalized
                         *     - 4: deleted
                         *     - 5: waiting extra approval
                         *     - 7: archived
                         * @enum {integer}
                         */
                        status?: 0 | 1 | 2 | 3 | 4 | 5 | 7;
                        /** @description total donation */
                        donation_total?: number;
                        /**
                         * @description true if the campaign is pinned to the Featured Campaigns block on the public fundraising landing page.
                         *     Up to 6 campaigns per association may be featured at once. The flag auto-clears when a campaign leaves
                         *     an active status (finalize / archive / reject / delete).
                         */
                        featured?: boolean;
                        /** @description true if phone is asked */
                        phone_show?: boolean;
                        /** @description true if phone is required */
                        phone_required?: boolean;
                        /** @description true if birthday is asked */
                        birthday_show?: boolean;
                        /** @description true if birthday is required */
                        birthday_required?: boolean;
                        /** @description true if address is asked */
                        address_show?: boolean;
                        /** @description true if address is required */
                        address_required?: boolean;
                        /** @description true if tckno is asked */
                        tckno_show?: boolean;
                        /** @description true if tckno is required */
                        tckno_required?: boolean;
                        /** @description true if donors may leave a message. Ships enabled, unlike the other *_show flags */
                        message_show?: boolean;
                        /** @description donation category id */
                        sub_donation_type_id?: number;
                        /** @description thanks mail id */
                        thanks_mail_id?: number;
                        /** @description payment system id */
                        payment_settings_id?: number;
                        /** @description certificate */
                        certificate_id?: number;
                        /** @description thanks sms id */
                        thanks_sms_id?: number;
                        /** @description referral certificate id */
                        referral_certificate_id?: number;
                        /** @description referral thanks mail id */
                        referral_thanks_mail_id?: number;
                        /** @description true if campaign has a special date */
                        has_special_date?: boolean;
                        /**
                         * Format: date
                         * @description special date of campaign
                         */
                        event_date?: string;
                        bank_account_list?: components["schemas"]["BankAccount"][];
                        /** @description updated title value before approval */
                        update_title?: string;
                        /** @description updated image value before approval */
                        update_image?: string;
                        /** @description updated campaign message value before approval */
                        update_personal_message?: string;
                        /** @description fundraising event id */
                        association_campaign_target_id?: number;
                    };
                };
            };
        };
        /** @description Fundraising Events are listed successfully */
        FundraisingEventListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    event_list?: components["schemas"]["FundraisingEventDetail"][];
                };
            };
        };
        /** @description Fundraising Event Details are listed successfully */
        FundraisingEventDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Total number of FundraisingEvents */
                    total?: number;
                };
            };
        };
        /** @description Fundraising teams campaigns are listed successfully */
        FundraisingTeamCampaignListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    team_campaign_list?: {
                        /** @description fundraising team campaign id */
                        id?: number;
                        /** @description fundraising team campaign title */
                        title?: string;
                        /** @description fundraising team campaign is default ornot */
                        default?: boolean;
                        /** @description Fundraising team campaign target currency display */
                        target_currency__display?: number;
                    }[];
                };
            };
        };
        /** @description Fundraising teams are listed successfully */
        FundraisingTeamListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    team_list?: components["schemas"]["FundraisingTeamDetail"][];
                    /** @description Total number of fundraising teams matching criteria */
                    total?: number;
                };
            };
        };
        /** @description Forms are listed successfully */
        FormListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    form_list?: components["schemas"]["Form"][];
                    /** @description Total number of Forms */
                    total?: number;
                };
            };
        };
        /** @description Forms answer details are listed successfully */
        FormAnswerDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    answer?: components["schemas"]["FormAnswerDetails"];
                };
            };
        };
        /** @description E-Card details fetched successfully */
        EcardDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    ecard?: components["schemas"]["EcardDetails"];
                };
            };
        };
        /** @description E-Cards are listed successfully */
        EcardListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    ecard_list?: {
                        /** @description ecard id */
                        id?: number;
                        /** @description ecard title */
                        title?: string;
                        /** @description ecard is active or not */
                        active?: boolean;
                        /** @description ecard display order */
                        order?: number;
                        /** @description ecard is available for sale on ecard page */
                        listing?: number;
                        /** @description ecard is marked as starred status in ecard page */
                        starred?: boolean;
                        /** @description ecard categories name list */
                        categories?: string[];
                    }[];
                    /** @description Total number of EcardTransactions */
                    total?: number;
                };
            };
        };
        /** @description E-Card transactions are listed successfully */
        EcardTransactionListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    sale_list?: components["schemas"]["EcardTransaction"][];
                    /** @description Total number of EcardTransactions */
                    total?: number;
                };
            };
        };
        /** @description E-Card Transaction Details fetched successfully */
        EcardTransactionDetailsResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    ecard_transaction?: components["schemas"]["EcardTransactionDetail"];
                };
            };
        };
        /** @description Fundraising campaign created successfully */
        CreateFundraisingCampaignResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "campaign_id": 24355
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    /** @description created fundraising campaign id */
                    campaign_id?: number;
                };
            };
        };
        /** @description Donation/E-Card category created successfully */
        CreateCategorySuccess: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "category_id": 24355
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    /** @description created category id */
                    category_id?: number;
                };
            };
        };
        /** @description Event created successfully */
        CreateEventResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "event_id": 24355
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    /** @description created event id */
                    event_id?: number;
                };
            };
        };
        /** @description User created successfully */
        CreateUserResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "user_id": 24355
                 *     }
                 */
                "application/json": {
                    /** @description created user id */
                    user_id?: number;
                };
            };
        };
        /** @description Operation successful */
        CreateTagResult: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "tag_id": 156
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    /** @description created tag id */
                    tag_id?: number;
                };
            };
        };
        /** @description Operation successful */
        CreateTemplateSuccess: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "template_id": 156
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    /** @description created template id */
                    template_id?: number;
                };
            };
        };
        /** @description Webhook list */
        WebhookListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    webhook_list?: components["schemas"]["WebhookList"][];
                };
            };
        };
        /** @description webhook details */
        WebhookDetails: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    webhook?: components["schemas"]["Webhook"];
                };
            };
        };
        /** @description Template list */
        TemplateListResponse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description total number of templates */
                    total?: number;
                    template_list?: components["schemas"]["TemplateList"][];
                };
            };
        };
        /** @description Template details */
        TemplateDetails: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    template?: components["schemas"]["Template"];
                };
            };
        };
        /** @description Operation successful */
        Success: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok"
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                };
            };
        };
        /**
         * @description Operation successful. `merge` reports the automatic duplicate merge, which runs
         *     after the answer is already approved or rejected and so cannot fail the request.
         *     - `merged`: the two contacts were merged. `user_id` survived, `merged_user_id` is
         *       now `DELETED_MERGED` - stop using it
         *     - `none`: the contact had no pending duplicate. The ordinary case
         *     - `skipped`: a rule refused the pair (`no_permission`: the actor lacks EDIT_USERS;
         *       `not_mergeable`: an account owner or an admin profile). Retrying will refuse it
         *       identically
         *     - `failed`: the merge did not complete. The pair stays queued under Birleştirme
         *       Adayları and can be merged from the console
         */
        RespondFormAnswerResult: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "merge": {
                 *         "status": "merged",
                 *         "user_id": 4221674,
                 *         "merged_user_id": 5505707
                 *       }
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    merge?: {
                        /** @enum {string} */
                        status?: "merged" | "none" | "skipped" | "failed";
                        /**
                         * @description Present on skipped and failed
                         * @enum {string}
                         */
                        reason?: "no_permission" | "not_mergeable" | "error";
                        /** @description Human-readable explanation, when there is one */
                        message?: string;
                        /** @description The surviving contact, on merged */
                        user_id?: number;
                        /** @description The retired contact, on merged */
                        merged_user_id?: number;
                        /** @description The candidate pair's survivor, on skipped and failed */
                        first_user_id?: number;
                        /** @description The candidate pair's other side, on skipped and failed */
                        second_user_id?: number;
                    };
                };
            };
        };
        /** @description Donation created */
        CreateDonationResult: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "result": "ok",
                 *       "result_code": "200",
                 *       "donation_id": 1,
                 *       "member_id": 2,
                 *       "fundraising_campaign_id": 3
                 *     }
                 */
                "application/json": {
                    /** @description ok */
                    result?: string;
                    /** @description result status */
                    result_code?: string;
                    /** @description created donation id */
                    donation_id?: number;
                    /** @description created donations user id */
                    member_id?: number;
                    /** @description created donations fundraising campaign id */
                    fundraising_campaign_id?: number;
                };
            };
        };
        /** @description Permissions Listed */
        CommunicationPermissionList: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Total number of records */
                    total?: number;
                    /** @description permissions changed in the window, newest change first */
                    permission_list?: {
                        /** @description user id */
                        id?: number;
                        /**
                         * Format: email
                         * @description email
                         */
                        email?: string;
                        /** @description phone in international format */
                        phone?: string;
                        /** @description phone in E164 format */
                        phone_slug?: string;
                        /** @description if user has communication permission via phone */
                        allow_comm_via_phone?: boolean;
                        /**
                         * Format: date-time
                         * @description phone communication permission update date
                         */
                        allow_comm_via_phone_date?: string | null;
                        /** @description if user has communication permission via sms */
                        allow_comm_via_sms?: boolean;
                        /**
                         * Format: date-time
                         * @description sms communication permission update date
                         */
                        allow_comm_via_sms_date?: string | null;
                        /** @description if user has communication permission via email */
                        allow_comm_via_email?: boolean;
                        /**
                         * Format: date-time
                         * @description email communication permission update date
                         */
                        allow_comm_via_email_date?: string;
                    }[];
                };
            };
        };
        /** @description Operation Failed */
        OperationFailed: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Operation Fail Reason */
                    error?: string;
                };
            };
        };
        /** @description Unauthorized Access */
        UnauthorizedAccess: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Unauthorized Access */
                    error?: string;
                };
            };
        };
        /** @description No Valid Plan */
        NoValidPlan: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description No Valid Plan */
                    error?: string;
                };
            };
        };
        /** @description No Permission */
        NoPermission: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description No Permission */
                    error?: string;
                };
            };
        };
        /** @description Object Not Found */
        ObjectNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Object that cannot be found */
                    error?: string;
                };
            };
        };
        /** @description The template is still in use, so it cannot be deleted */
        TemplateInUse: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Where the template is used, such as "This template is connected to a fundraising campaign: Winter Campaign" */
                    error?: string;
                };
            };
        };
        /** @description Invalid Request */
        InvalidRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Invalid Request */
                    error?: string;
                };
            };
        };
        /** @description Not Implemented */
        NotImplemented: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @description Not Implemented */
                    error?: string;
                };
            };
        };
        /** @description Request fails */
        Fail: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Invalid values"
                 *     }
                 */
                "application/json": {
                    /** @description Error reason */
                    error?: string;
                };
            };
        };
    };
    parameters: {
        /** @description search parameter. start with - (minus) char to exclude searched text */
        Query: string;
        /** @example 2020-01-01T00:00:00%2B03:00 */
        StartDate: string;
        /** @example 2020-01-31T23:59:59%2B03:00 */
        EndDate: string;
        /** @description start page of records */
        StartPage: number;
        /** @description How many records should be listed */
        HowMany: number;
        /** @description card BIN number */
        BinNumber: number;
        /** @description card last four digits */
        LastFour: number;
        /** @description payment/debt amount */
        Amount: number;
        /**
         * @description amount condition if amount filter is present
         *     - null: equals to amount
         *     - !=: not equals to amount
         *     - <: smaller than amount
         *     - <=: smaller and equal to amount
         *     - \>: bigger than amount
         *     - \>=: bigger and equal to amount
         */
        AmountCondition: null | "!=" | "<" | "<=" | ">" | ">=";
        /**
         * @description payment type code
         *     - null: All
         *     - 0: Card
         *     - 1: Cash
         *     - 2: Wire Transfer
         *     - 3: POS
         *     - 4: SMS
         *     - 6: Postal Check
         *     - 7: Paypal
         *     - 8: BKM Express
         *     - 9: iDEAL
         *     - 10: Pay With Iyzico
         */
        PaymentMethod: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    };
    requestBodies: {
        CreateUpdateFundraisingTeamCampaign: {
            content: {
                "application/json": {
                    /** @description Fundraising team campaign is currently active & default */
                    default?: boolean;
                    /** @description Fundraising teams' campaign title */
                    title: string;
                    /** @description true if campaign has target */
                    has_target?: boolean;
                    /** @description campaign target. Required when has_target is true. */
                    target?: number;
                    /** @description campaign target currency id. Required when has_target is true; when has_target is false the team's own currency is used. */
                    target_currency_id?: number;
                };
            };
        };
        RespondFormAnswer: {
            content: {
                "application/json": {
                    /**
                     * @description response type
                     * @enum {string}
                     */
                    response_type: "approve" | "reject";
                    /** @description approval/rejection details */
                    answer: {
                        /**
                         * @description True if you want to send email to the person who answered the form.
                         *     `subject` and `message` are then required: without them the request is refused with 400 and the answer is not approved, rejected or refunded.
                         */
                        send_mail?: boolean;
                        /**
                         * @description how to assign the new membership number
                         *     - no: does not make any changes
                         *     - auto: assigns the next available membership number incrementally
                         *     - custom: sets your value
                         * @enum {string}
                         */
                        membership_no_decision?: "no" | "auto" | "custom";
                        /** @description custom membership number you'd like to set, valid when membership_no_decision is custom */
                        membership_no?: number;
                        /**
                         * @description True if the subject and message are taken from a saved template.
                         *     The template's text is not read: send it in `subject` and `message` as well.
                         */
                        send_from_template?: boolean;
                        /** @description True if mail includes the logo of association */
                        has_association_logo?: boolean;
                        /** @description Template Title */
                        title?: string;
                        /** @description Subject of the email. Required when `send_mail` is true */
                        subject?: string;
                        /**
                         * @description Content of the email (HTML). Required when `send_mail` is true.
                         *     Markup with nothing visible in it, such as `<p></p>`, counts as missing; an image alone is enough.
                         */
                        message?: string;
                        /** @description True if you want to overwrite message of template */
                        update_template?: boolean;
                        /** @description True if you want to save message as template */
                        save_as_template?: boolean;
                        /** @description whether a button is added or not */
                        has_button?: boolean;
                        /** @description background color in HEX format, such as */
                        background_color?: string;
                        /** @description text color in HEX format, such as */
                        body_color?: string;
                        /** @description footer text color in HEX format, such as */
                        footer_text_color?: string;
                        /** @example 2 */
                        footer_icon_color?: number;
                        /** @description button text */
                        btn_text?: string;
                        /** @description button color in HEX format, such as */
                        btn_color?: string;
                        /** @description button text in HEX format, such as */
                        btn_text_color?: string;
                        /**
                         * @description button operation. 1 for URL, 2 for Fonzip Related operation
                         * @enum {integer}
                         */
                        btn_operation?: 1 | 2;
                        /** @description button action detail */
                        btn_operation_detail?: ("login" | "cc" | "donation" | "dues" | "member_card") | string;
                        /** @description ID of the saved template, when `send_from_template` is true */
                        template_id?: number;
                        /** @description refund if there's a payment of form answer */
                        make_refund?: boolean;
                    };
                };
            };
        };
        UpdateFundraisingTeam: {
            content: {
                "application/json": {
                    /** @description user id */
                    user_id: number;
                    /** @description campaign image url */
                    image?: string;
                    /** @description Fundraising team default Currency ID */
                    currency_id: number;
                    /** @description Fundraising team title */
                    title: string;
                    /** @description Fundraising team description */
                    details: string;
                    /**
                     * @description fundraising team status
                     *     - 0: waiting approval
                     *     - 1: approved
                     *     - 2: rejected
                     *     - 3: waiting extra approval
                     *     - 4: deleted
                     *     - 5: archived
                     * @enum {number}
                     */
                    status?: 0 | 1 | 2 | 3 | 4 | 5;
                    campaign_list: {
                        /** @description Fundraising team campaign id */
                        id?: number;
                        /** @description Fundraising team campaign is currently active & default */
                        default?: boolean;
                    }[];
                };
            };
        };
        CreateFundraisingTeam: {
            content: {
                "application/json": {
                    /** @description user id */
                    user_id: number;
                    /** @description campaign image url */
                    image?: string;
                    /** @description Fundraising team default Currency ID */
                    currency_id?: number;
                    /** @description Fundraising team title */
                    title: string;
                    /** @description Fundraising team description */
                    details: string;
                    campaign: {
                        /** @description Fundraising teams' campaign title */
                        title: string;
                        /** @description true if campaign has target */
                        has_target?: boolean;
                        /** @description campaign target. Required when has_target is true. */
                        target?: number;
                        /** @description campaign target currency id. Required when has_target is true; when has_target is false the team's own currency is used. */
                        target_currency_id?: number;
                    };
                };
            };
        };
        /** @description Generate Token Request */
        GenerateToken: {
            content: {
                "application/x-www-form-urlencoded": {
                    /**
                     * @default client_credentials
                     * @enum {string}
                     */
                    grant_type: "client_credentials" | "authorization_code" | "refresh_token";
                    client_id: string;
                    client_secret: string;
                    /** @description Authorization code received from the authorize endpoint. Required if grant_type is authorization_code. */
                    code?: string;
                    /** @description Redirect URI used in the authorize request. Required if grant_type is authorization_code. */
                    redirect_uri?: string;
                    /** @description Refresh token received from the token endpoint. Required if grant_type is refresh_token. */
                    refresh_token?: string;
                };
            };
        };
        GetUserList: {
            content: {
                "application/json": {
                    search: components["schemas"]["UserSearch"];
                    values_list: components["schemas"]["UserSearchValues"][];
                };
            };
        };
        CreateUpdateCategory: {
            content: {
                "application/json": {
                    /** @description Donation/E-Card Category name */
                    name?: string;
                };
            };
        };
        DebtCategoryName: {
            content: {
                "application/json": {
                    /** @description Category name, unique in the organisation ignoring case. Trimmed. */
                    name: string;
                };
            };
        };
        DeleteDebtCategory: {
            content: {
                "application/json": {
                    /**
                     * @description Where the category's debts and add-debt automations go: another live
                     *     category, or null for none. Required when the category is in use.
                     */
                    replacement_id?: number | null;
                };
            };
        };
        CreateDonationRequest: {
            content: {
                "application/json": {
                    /**
                     * @description Donation Type
                     *     - 0: cash
                     *     - 1: noncash / inkind
                     * @enum {integer}
                     */
                    d_type?: 0 | 1;
                    /**
                     * Format: double
                     * @description donation amount
                     */
                    amount?: number;
                    /** @description Currency ISO Code */
                    currency?: string;
                    /**
                     * Format: date-time
                     * @description Donation Date
                     */
                    complete_date?: string;
                    /** @description Donation details */
                    details?: string;
                    /** @description User ID / if not available, a new user will be created */
                    member_id?: number;
                    /** @description first name */
                    first_name?: string;
                    /** @description last name */
                    last_name?: string;
                    /**
                     * Format: email
                     * @description email
                     */
                    email?: string;
                    /** @description phone number */
                    phone?: string;
                    /** @description Users Identity Number */
                    tckno?: string;
                    /**
                     * @description Donor's tax office (vergi dairesi). Only meaningful when
                     *     donor_type is "corporate"; ignored for personal donors.
                     */
                    tax_department?: string;
                    /**
                     * @description Donor type
                     *     - personal: donor is a person
                     *     - corporate: donor is an organization
                     * @enum {string}
                     */
                    donor_type?: "personal" | "corporate";
                    /**
                     * Format: date
                     * @description users birthday
                     */
                    birthday?: string;
                    /** @description district */
                    district?: string;
                    /** @description city */
                    city?: string;
                    /** @description address */
                    address?: string;
                    /** @description post/zip code */
                    post_code?: string;
                    payment_method?: components["schemas"]["PaymentMethod"];
                    /** @description bank transaction id */
                    transaction_id?: string;
                    /**
                     * @description payment_method_select
                     *     - card: card donation (!! Not available in API !!)
                     *     - other: other (must set to other)
                     * @enum {string}
                     */
                    payment_method_select?: "card" | "other";
                    /** @description receipt no */
                    receipt_no?: string;
                    /**
                     * @description donation section
                     *     - page: ngo fundraising page
                     *     - fundraising: fundraising campaign
                     *     - form: donation form/module
                     *     - other: other
                     * @enum {string}
                     */
                    section?: "page" | "fundraising" | "form" | "other";
                    /** @description donation category id */
                    category_id?: number;
                    /** @description ngo fundraising page id */
                    fundraising_page_id?: number;
                    /** @description donation form/module id */
                    module_id?: number;
                    /** @description fundraising campaign id */
                    fundraising_campaign_id?: number;
                    /** @description name is hidden in fundraising campaign donor list */
                    name_hidden?: boolean;
                    /** @description amount is visible in fundraising campaign donor list */
                    amount_visible?: boolean;
                    /** @description Bank Account ID */
                    bank_account_id?: number;
                    /** @description send mail to donor */
                    send_thanks_mail?: boolean;
                    /** @description mail template id */
                    thanks_mail_id?: number;
                    /** @description ecard id */
                    ecard_id?: number;
                    /** @description send thanks sms */
                    send_thanks_sms?: boolean;
                    /** @description sms template id */
                    thanks_sms_id?: number;
                    /** @description donation in honor of someone */
                    referring?: boolean;
                    /** @description honorees name */
                    referring_name?: string;
                    /**
                     * Format: email
                     * @description honoree's email
                     */
                    referring_email?: string;
                    /** @description honoree's phone */
                    referring_phone?: string;
                    /** @description honoree's district */
                    referring_district?: string;
                    /** @description honoree's city */
                    referring_city?: string;
                    /** @description honoree's address */
                    referring_address?: string;
                    /** @description mail template id to send to honoree */
                    referring_thanks_mail_id?: number;
                    /** @description ecard id to send to honoree */
                    referring_ecard_id?: number;
                };
            };
        };
        CreateMonthlyDonationUpdateRequest: {
            content: {
                "application/json": {
                    /**
                     * @description Request Type
                     *     - cancel: send cancellation request
                     *     - amount: send amount upgrade requests
                     * @enum {string}
                     */
                    type?: "cancel" | "amount";
                    /**
                     * @description Reason if request type is 'cancel'
                     *     New Amount if request type is 'amount'
                     */
                    value?: string;
                };
            };
        };
        CancelMonthlyDonationRequest: {
            content: {
                "application/json": {
                    /**
                     * @description must be "cancel"
                     * @example action
                     */
                    action: string;
                    /** @description Cancellation reason */
                    reason: string;
                    /**
                     * @description True if you want to send email to donor after cancelling donation.
                     *     `subject` and `message` are then required: without them the request is refused with 400 and the donation is not cancelled.
                     */
                    send_cancellation_mail?: boolean;
                    /**
                     * @description True if the subject and message are taken from a saved template.
                     *     The template's text is not read: send it in `subject` and `message` as well.
                     */
                    send_from_template?: boolean;
                    /** @description ID of the saved template, when `send_from_template` is true */
                    template_id?: number;
                    /** @description True if you want to overwrite the template with this subject and message */
                    update_template?: boolean;
                    /** @description True if you want to save message as template */
                    save_as_template?: boolean;
                    /** @description Template Title */
                    title?: string;
                    /** @description Subject of the email. Required when `send_cancellation_mail` is true */
                    subject?: string;
                    /**
                     * @description Content of the email (HTML). Required when `send_cancellation_mail` is true.
                     *     Markup with nothing visible in it, such as `<p></p>`, counts as missing; an image alone is enough.
                     */
                    message?: string;
                    /** @description True if mail includes the logo of association */
                    has_association_logo?: boolean;
                    /** @description True if template is for sms, False if template is for email */
                    type_sms?: boolean;
                    /** @description background color in HEX format, such as */
                    background_color?: string;
                    /** @description text color in HEX format, such as */
                    body_color?: string;
                    /** @description footer text color in HEX format, such as */
                    footer_text_color?: string;
                    /**
                     * @description footer icon color. 0 for gray, 1 for light, 2 for dark (default)
                     * @enum {integer}
                     */
                    footer_icon_color?: 0 | 1 | 2;
                    /** @description whether a button is added or not */
                    has_button?: boolean;
                    /** @description button text */
                    btn_text?: string;
                    /** @description button color in HEX format, such as */
                    btn_color?: string;
                    /** @description button text in HEX format, such as */
                    btn_text_color?: string;
                    /**
                     * @description button operation. 1 for URL, 2 for Fonzip Related operation
                     * @enum {integer}
                     */
                    btn_operation?: 1 | 2;
                    /** @description button action detail */
                    btn_operation_detail?: ("login" | "cc" | "donation" | "dues" | "member_card") | string;
                    /** @description translations of template */
                    translations?: {
                        language_code?: {
                            subject?: string;
                            message?: string;
                            btn_text?: string;
                        };
                    };
                };
            };
        };
        RespondMonthlyDonationAmountChangeRequest: {
            content: {
                /**
                 * @example {
                 *       "approval": true
                 *     }
                 */
                "application/json": {
                    /** @description true if amount update request will be approved, false to reject */
                    approval: boolean;
                };
            };
        };
        ChangeMonthlyDonationRequest: {
            content: {
                "application/json": {
                    /**
                     * @description Change Monthly Donation Attribute
                     *     - date: changes next withdrawal date
                     *     - category: changes donation category
                     *     - amount: changes monthly donation amount
                     *     - retry: retries withdrawal of donation
                     * @enum {string}
                     */
                    mode: "date" | "category" | "amount" | "retry";
                    /** @description donation id */
                    donation_id: number;
                    /**
                     * Format: date
                     * @description Next withdrawal date
                     */
                    recurring_next_cycle?: string;
                    /** @description donation category id */
                    category_id?: number;
                    /**
                     * Format: double
                     * @description next withdrawal amount
                     */
                    amount?: number;
                };
            };
        };
        SendCardUpdateRequestForMonthlyDonation: {
            content: {
                "application/json": {
                    /**
                     * @description Card Update Request mode
                     *     - email: send email to donor with a card update link for monthly donation
                     *     - sms: send sms to donor with a card update link for monthly donation
                     * @enum {string}
                     */
                    mode?: "email" | "sms";
                };
            };
        };
        CreateUser: {
            content: {
                "application/json": {
                    /** @description true if user is set as corporate/organization */
                    corporate_type?: boolean;
                    /** @description first name */
                    first_name: string;
                    /** @description last name */
                    last_name?: string;
                    /** @description Users Identity Number / Organization tax number */
                    tckno?: string;
                    /**
                     * Format: email
                     * @description email
                     */
                    email?: string;
                    /** @description phone */
                    phone?: string;
                    /**
                     * @description how to assign the new membership number
                     *     - no: does not make any changes
                     *     - auto: assigns the next available membership number incrementally
                     *     - custom: sets your value
                     * @enum {string}
                     */
                    membership_no_decision?: "no" | "auto" | "custom";
                    /** @description users membership number */
                    membership_no?: number;
                    /**
                     * Format: date
                     * @description Birthday
                     */
                    birthday?: string;
                    /**
                     * Format: email
                     * @description second email
                     */
                    email_second?: string;
                    /** @description nationality */
                    nationality_text?: string;
                    /** @description Home phone */
                    home_phone_first?: string;
                    /** @description Address */
                    address?: string;
                    /** @description District */
                    district_text?: string;
                    /** @description City */
                    city_text?: string;
                    /** @description Country */
                    country_text?: string;
                    /** @description Post code */
                    post_code?: string;
                    /** @description Work phone */
                    work_phone?: string;
                    /** @description Work address */
                    work_address?: string;
                    /** @description Work district */
                    work_district_text?: string;
                    /** @description Work city */
                    work_city_text?: string;
                    /** @description Work country */
                    work_country_text?: string;
                    /** @description Work post code */
                    work_post_code?: string;
                    /**
                     * Format: date-time
                     * @description users application date
                     */
                    apply_date?: string;
                    /**
                     * Format: date-time
                     * @description users join date
                     */
                    join_date?: string;
                    /** @description if user has communication permission via phone */
                    allow_comm_via_phone?: boolean;
                    /** @description if user has communication permission via sms */
                    allow_comm_via_sms?: boolean;
                    /** @description if user has communication permission via email */
                    allow_comm_via_email?: boolean;
                    /**
                     * Format: date-time
                     * @description phone communication permission update date
                     */
                    allow_comm_via_phone_date?: string;
                    /**
                     * Format: date-time
                     * @description sms communication permission update date
                     */
                    allow_comm_via_sms_date?: string;
                    /**
                     * Format: date-time
                     * @description email communication permission update date
                     */
                    allow_comm_via_email_date?: string;
                    user_defined_values?: components["schemas"]["UserDefinedValuesReference"];
                    /** @description tag id's to be added */
                    tags?: number[];
                };
            };
        };
        UpdateUser: {
            content: {
                "application/json": {
                    /**
                     * @description Updating field type.
                     *     - single: for single system defined field
                     *     - multiple: for multiple fields
                     *     - udv: for single user defined value field
                     *     - membership_no: updating membership no
                     * @enum {string}
                     */
                    type: "single" | "multiple" | "udv" | "membership_no";
                    data: components["schemas"]["UserSingleFieldUpdate"] | components["schemas"]["UserMultipleFieldUpdate"] | components["schemas"]["UserUdvFieldUpdate"] | components["schemas"]["UserMembershipNoUpdate"];
                };
            };
        };
        UpdateStatus: {
            content: {
                "application/json": {
                    /** @description true for active, false for passive */
                    active: boolean;
                };
            };
        };
        UpdateDebtStatus: {
            content: {
                "application/json": {
                    /**
                     * @description action to apply to the debt
                     *     - remove: removes the debt
                     *     - activate: activates the debt
                     * @enum {string}
                     */
                    action: "remove" | "activate";
                };
            };
        };
        CreateDebt: {
            content: {
                "application/json": {
                    /** @description user id */
                    user_id?: number;
                    /** @description debt description */
                    details?: string;
                    /**
                     * Format: double
                     * @description debt amount ( also payment amount if custom amount is 'custom'.)
                     */
                    amount?: number;
                    /**
                     * Format: date-time
                     * @description Membership Due Operation Date
                     */
                    operation_date?: string;
                    /** @description bill no */
                    bill_no?: string;
                    /** @description if debt is recurring */
                    recurring?: boolean;
                    /**
                     * Format: date
                     * @description Period Date
                     */
                    period?: string;
                    /** @description Recurring period in days */
                    recurring_period?: number;
                    /**
                     * Format: date-time
                     * @description Debts Due Date
                     */
                    due_date?: string;
                    /**
                     * @description Record the member's payment right after adding the debt. It uses this body too:
                     *     `details`, `operation_date` and `period` apply to both. Card payments cannot be
                     *     taken through the API.
                     */
                    add_payment?: boolean;
                    /**
                     * @description The payment's amount (with add_payment)
                     *     - total_debt: what the member owes once the debt is added
                     *     - custom: `amount`, required and above 0, also when the debt's own amount comes
                     *       from `amount_type: udv`
                     * @enum {string}
                     */
                    custom_amount?: "total_debt" | "custom";
                    /** @description The payment's bank transaction id / wire transfer query no (with add_payment) */
                    transaction_id?: string;
                    /** @description The payment's receipt no (with add_payment) */
                    receipt_no?: string;
                    /**
                     * @description The bank account the payment was made to (with add_payment), see
                     *     `/bank-accounts`. Another organisation's account is refused with 404 before
                     *     anything is written.
                     */
                    bank_account_id?: number | null;
                    /**
                     * @description Send the member the `thanks_mail_id` template once the debt (and its payment)
                     *     is recorded
                     */
                    send_mail?: boolean;
                    /** @description The mail template to send with send_mail. A deleted or unknown one is refused with 404 before anything is written. */
                    thanks_mail_id?: number;
                    /**
                     * @description Debt category (see `/debt-categories`). Leave it out or send null for none.
                     *     A deleted or another organisation's category is refused with 404.
                     */
                    debt_category_id?: number | null;
                    /**
                     * @description Where the amount comes from
                     *     - custom: `amount`
                     *     - udv: the member's user defined value named by `amount_udv_key`
                     * @default custom
                     * @enum {string}
                     */
                    amount_type?: "custom" | "udv";
                    /** @description The user defined value's key, for amount_type udv */
                    amount_udv_key?: string;
                    /**
                     * @description payment type selection. must be other for API
                     * @default other
                     * @enum {string}
                     */
                    payment_method_select?: "other" | "card";
                    payment_method?: components["schemas"]["PaymentMethod"];
                };
            };
        };
        UpdateDebt: {
            content: {
                "application/json": {
                    /**
                     * Format: date
                     * @description Period Date
                     */
                    period?: string;
                    /** @description debt description */
                    details?: string;
                    /** @description remove debt description for removed debt status */
                    remove_note?: string;
                    /**
                     * @description Debt category. Left out, the category is kept; null removes it. A changed
                     *     value must be a live category of the organisation; the debt's current one is
                     *     accepted even if it was deleted since.
                     */
                    debt_category_id?: number | null;
                    /**
                     * Format: date-time
                     * @description Membership Due Operation Date
                     */
                    operation_date?: string;
                    /** @description bill no */
                    bill_no?: string;
                    /**
                     * Format: date-time
                     * @description Debts Due Date
                     */
                    due_date?: string;
                    /** @description Recurring period in days */
                    recurring_period?: number;
                    transaction?: {
                        /**
                         * Format: double
                         * @description debt amount
                         */
                        amount?: number;
                        /** @description bank transaction id / wire transfer query no */
                        transaction_id?: string;
                        payment_method?: components["schemas"]["PaymentMethod"];
                    };
                };
            };
        };
        CreateEventTicket: {
            content: {
                "application/json": {
                    /** @description Ticket name */
                    title: string;
                    /**
                     * Format: double
                     * @description Price
                     */
                    price?: number;
                    /**
                     * @description Ticket type
                     *     - paid: paid ticket
                     *     - free: free ticket
                     * @enum {string}
                     */
                    ticket_type?: "paid" | "free";
                    /** @description ticket description */
                    details?: string;
                    /** @description message to be shown after the ticket is purchased */
                    post_sale_message?: string;
                    /** @description true if ticket sale must start on specific date */
                    sales_start_on_date?: boolean;
                    /**
                     * Format: date-time
                     * @description Ticket sale start date
                     */
                    sales_start?: string;
                    /** @description true if ticket sale must end on specific date */
                    sales_end_on_date?: boolean;
                    /**
                     * Format: date-time
                     * @description Ticket sale end date
                     */
                    sales_end?: string;
                    /** @description maximum number of tickets a user can buy */
                    max_per_person?: number;
                    /**
                     * @description ticket can only be bought by users with selected tags
                     *     - 0: No control
                     *     - 1: Ok if user has any of the selected tags
                     *     - 2: Ok if user has all of the selected tags
                     * @enum {integer}
                     */
                    tag_control?: 0 | 1 | 2;
                    /** @description tag_id's for tag control */
                    tags_to_control?: number[];
                    /** @description true if ticket can only be bought by users with no debt */
                    member_with_no_debt?: boolean;
                    /** @description true if ticket can only be bought if users related organization has no debt */
                    related_with_no_debt?: boolean;
                };
            };
        };
        CreateEvent: {
            content: {
                "application/json": components["schemas"]["CreateEvent"];
            };
        };
        UpdateEventStatus: {
            content: {
                "application/json": {
                    /** @description true if event is active, false if event is passive */
                    active?: boolean;
                };
            };
        };
        FundraisingEvent: {
            content: {
                "application/json": components["schemas"]["FundraisingEvent"];
            };
        };
        FundraisingCampaign: {
            content: {
                "application/json": components["schemas"]["FundraisingCampaign"];
            };
        };
        FundraisingCampaignUpdate: {
            content: {
                "application/json": components["schemas"]["FundraisingCampaignUpdate"];
            };
        };
        CreateTag: {
            content: {
                "application/json": {
                    /** @description Tag Name */
                    name: string;
                    /**
                     * @description Tag color
                     * @enum {string}
                     */
                    color: "tag-1" | "tag-2" | "tag-3" | "tag-4" | "tag-5" | "tag-6" | "tag-7" | "tag-8";
                };
            };
        };
        Webhook: {
            content: {
                "application/json": {
                    /** @description Webhook Id */
                    id?: number;
                    /** @description Webhook Name */
                    name: string;
                    /**
                     * Format: uri
                     * @description Webhook URL
                     */
                    url: string;
                    /** @description True if authentication header is set */
                    authentication?: boolean;
                    /** @description basic authentication header value */
                    auth_token?: string;
                    events: {
                        /** @description subscribe to donations */
                        DONATION?: boolean;
                        /** @description subscribe to membership dues */
                        SUBSCRIPTION?: boolean;
                        /** @description subscribe to ticket sales */
                        TICKET?: boolean;
                        /** @description subscribe to form answers */
                        FORM?: boolean;
                        /** @description subscribe to E-Card transactions */
                        CERTIFICATE_SALE?: boolean;
                        /** @description subscribe to fundraising campaigns */
                        FUNDRAISING_CAMPAIGN?: boolean;
                    };
                };
            };
        };
        Template: {
            content: {
                "application/json": {
                    /** @description Template category id */
                    category_id?: number;
                    /** @description Template category name */
                    category__name?: string;
                    /** @description Template Title */
                    title?: string;
                    /** @description Subject */
                    subject?: string;
                    /** @description Template content */
                    message?: string;
                    /** @description True if mail includes the logo of association */
                    has_association_logo?: boolean;
                    /** @description True if template is for sms, False if template is for email */
                    type_sms?: boolean;
                    /** @description background color in HEX format, such as */
                    background_color?: string;
                    /** @description text color in HEX format, such as */
                    body_color?: string;
                    /** @description footer text color in HEX format, such as */
                    footer_text_color?: string;
                    /**
                     * @description footer icon color. 0 for gray, 1 for light, 2 for dark (default)
                     * @enum {integer}
                     */
                    footer_icon_color?: 0 | 1 | 2;
                    /** @description whether a button is added or not */
                    has_button?: boolean;
                    /** @description button text */
                    btn_text?: string;
                    /** @description button color in HEX format, such as */
                    btn_color?: string;
                    /** @description button text in HEX format, such as */
                    btn_text_color?: string;
                    /**
                     * @description button operation. 1 for URL, 2 for Fonzip Related operation
                     * @enum {integer}
                     */
                    btn_operation?: 1 | 2;
                    /** @description button action detail */
                    btn_operation_detail?: ("login" | "cc" | "donation" | "dues" | "member_card") | string;
                    /** @description translations of template */
                    translations?: {
                        language_code?: {
                            subject?: string;
                            message?: string;
                            btn_text?: string;
                        };
                    };
                };
            };
        };
        UpdateFundraisingCampaignStatus: {
            content: {
                "application/json": {
                    /**
                     * @description set status of fundraising campaign
                     *     - reactivate: reactivate finalized campaign
                     *     - finalize: finalize active campaign
                     *     - featured: toggle the featured flag on the campaign (requires `featured` body field; up to 6 campaigns per association may be featured; only active campaigns are eligible)
                     * @enum {string}
                     */
                    action?: "reactivate" | "finalize" | "featured";
                    /**
                     * @description Required when `action=featured`. Pass `true` to add the campaign to the Featured Campaigns block,
                     *     `false` to remove it. Adding beyond the 6-campaign cap responds with HTTP 400.
                     */
                    featured?: boolean;
                };
            };
        };
    };
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getAccessToken: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["GenerateToken"];
        responses: {
            200: components["responses"]["GenerateToken"];
            400: components["responses"]["InvalidAuthorizationGrant"];
            401: components["responses"]["InvalidCredentials"];
            402: components["responses"]["InvalidGrant"];
            405: components["responses"]["InvalidRequestMethod"];
            406: components["responses"]["GrantTypeError"];
            429: components["responses"]["RateLimitExceeded"];
            500: components["responses"]["GenerateTokenFail"];
        };
    };
    oauthAuthorizeGet: {
        parameters: {
            query: {
                response_type: "code";
                client_id: string;
                redirect_uri?: string;
                state?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK - Consent page rendered */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Found - Redirect to login if not authenticated */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["GetMeResponse"];
            401: components["responses"]["UnauthorizedAccess"];
            429: components["responses"]["RateLimitExceeded"];
        };
    };
    getUserList: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["GetUserList"];
        responses: {
            200: components["responses"]["GetUserListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUsersTimeline: {
        parameters: {
            query: {
                /** @description return total number of timeline events */
                require_total?: boolean;
                /** @description list only notes */
                notes_only?: boolean;
                /** @description filter by note tag if notes_only is true */
                tag_id?: number;
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["GetUsersTimelineResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUsersTagsList: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["GetUsersTagListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    addTagToUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
                tag_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    removeTagFromUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
                tag_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUsersDonationList: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["UsersDonationListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUsersMicroDonationList: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["UsersDonationListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUsersMonthlyDonationList: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["UsersMonthlyDonationListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createMonthlyDonationUpdateRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
                donation_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateMonthlyDonationUpdateRequest"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    sendCardUpdateRequestForMonthlyDonation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
                donation_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["SendCardUpdateRequestForMonthlyDonation"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    listChangedCommunicationPermissions: {
        parameters: {
            query: {
                days?: number;
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                permission_type: "email" | "sms" | "phone";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["CommunicationPermissionList"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getCommunicationPermissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                permission_type: "email" | "sms" | "phone";
                permission_value: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Permissions Listed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description the permission records of the value */
                        permission_list?: {
                            /** @description user id */
                            id?: number;
                            /**
                             * Format: email
                             * @description email
                             */
                            email?: string;
                            /** @description phone in international format */
                            phone?: string;
                            /** @description phone in E164 format */
                            phone_slug?: string;
                            /** @description if user has communication permission via phone */
                            allow_comm_via_phone?: boolean;
                            /**
                             * Format: date-time
                             * @description phone communication permission update date
                             */
                            allow_comm_via_phone_date?: string | null;
                            /** @description if user has communication permission via sms */
                            allow_comm_via_sms?: boolean;
                            /**
                             * Format: date-time
                             * @description sms communication permission update date
                             */
                            allow_comm_via_sms_date?: string | null;
                            /** @description if user has communication permission via email */
                            allow_comm_via_email?: boolean;
                            /**
                             * Format: date-time
                             * @description email communication permission update date
                             */
                            allow_comm_via_email_date?: string;
                        }[];
                    };
                };
            };
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateCommunicationPermissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                permission_type: "email" | "sms" | "phone";
                permission_value: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description communication permitted or not */
                    permission: boolean;
                    /**
                     * Format: date-time
                     * @description value last update date
                     */
                    update_date: string;
                    /** @description additional details like channel, IP address etc. */
                    details?: string;
                };
            };
        };
        responses: {
            /** @description Permission Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Updated permission count */
                        update_count?: number;
                    };
                };
            };
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    cancelMonthlyDonation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CancelMonthlyDonationRequest"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    respondMonthlyDonationAmountChangeRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["RespondMonthlyDonationAmountChangeRequest"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    changeMonthlyDonationValues: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                monthly_donation_order_id: string;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["ChangeMonthlyDonationRequest"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUsersMembershipDueList: {
        parameters: {
            query: {
                listing?: "a" | "p" | "d" | "r";
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["UsersMembershipDuesResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUserBoughtTicketList: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["TicketListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUserAnswerList: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["UsersFormAnswerListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUserEcardTransactionList: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["UserEcardTransactionListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    generateLoginLinkForUser: {
        parameters: {
            query?: {
                redirection_type?: 3 | 4 | 5 | 10 | 12;
            };
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["LoginLinkResponse"];
            400: components["responses"]["Fail"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUserDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["UserDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["UpdateUser"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateUser"];
        responses: {
            200: components["responses"]["CreateUserResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getUserDefinedValuesList: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["UserDefinedListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getTagsList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["TagListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createTag: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateTag"];
        responses: {
            200: components["responses"]["CreateTagResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateTag: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tag_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateTag"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteTag: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tag_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDonationList: {
        parameters: {
            query: {
                /** @description what kind of donations should be listed */
                status: "paid" | "refund" | "failed";
                /** @description which values should be listed */
                list?: ("details" | "name_surname" | "address" | "amount" | "sub_donation_type" | "birthday" | "email_status" | "complete_date" | "fundraising_campaign" | "tckno" | "tax_department" | "phone" | "donation_page" | "module" | "payment_method" | "added_by_id" | "f2f_group_id" | "fonzip_id" | "recurring_order_id" | "recurring_withdraw_count" | "recurring_total_withdraw_count" | "recurring_total_withdraw_amount" | "transaction_id" | "provision_no" | "auth_code" | "reference_id" | "ip_address" | "fundraising_campaign_user" | "api_tracking_id" | "news_via_phone" | "news_via_sms" | "news_via_email" | "application" | "card_number" | "receipt_no" | "donor_type" | "amount_visible" | "name_hidden" | "message" | "show_message" | "referring_name" | "referring_email" | "referring_phone" | "bank_account__name" | "payment_settings__name" | "recurring_cancel_reason" | "recurring_cancel_date" | "recurring_start_date" | "recurring_stop_date" | "cancelled_by_id" | "marketing_channel__utm_source" | "marketing_channel__utm_medium" | "marketing_channel__utm_campaign" | "marketing_channel__utm_content")[];
                /** @description donation category id, null for all */
                category_id?: number;
                /** @description when true, return only donations that have no donation category assigned. Ignored if category_id is also supplied. */
                no_category?: boolean;
                /** @description donation page id */
                donation_page?: number;
                /** @description fundraising campaign id */
                fundraising_campaign?: number;
                /** @description fundraising event id */
                association_campaign_target?: number;
                /** @description payment settings id */
                payment_settings_id?: number;
                /** @description bank account id */
                bank_account_id?: number;
                /**
                 * @description Filter donations whose marketing channel `utm_source` matches one of
                 *     the supplied values (IN-list). Repeat the parameter to supply
                 *     multiple values, e.g. `?utm_source=google&utm_source=bing`.
                 */
                utm_source?: string[];
                /** @description Filter donations by one or more `utm_medium` values (IN-list). */
                utm_medium?: string[];
                /** @description Filter donations by one or more `utm_campaign` values (IN-list). */
                utm_campaign?: string[];
                /** @description Filter donations by one or more `utm_content` values (IN-list). */
                utm_content?: string[];
                /**
                 * @description When true, return only donations with no marketing channel attached
                 *     (organic / direct traffic). Mutually exclusive with the four UTM
                 *     filters above — when set, those are ignored.
                 */
                marketing_channel_null?: boolean;
                /** @description API Tracking ID */
                api_tracking_id?: string;
                /** @description ordering */
                order_by?: "name" | "-name" | "transaction__amount" | "-transaction__amount" | "transaction__complete_date" | "-transaction__complete_date";
                recurring?: 1 | 0 | -1;
                donor_type?: null | "personal" | "corporate";
                /** @description payment/debt amount */
                amount?: components["parameters"]["Amount"];
                /**
                 * @description amount condition if amount filter is present
                 *     - null: equals to amount
                 *     - !=: not equals to amount
                 *     - <: smaller than amount
                 *     - <=: smaller and equal to amount
                 *     - \>: bigger than amount
                 *     - \>=: bigger and equal to amount
                 */
                amt_cnd?: components["parameters"]["AmountCondition"];
                /** @description card BIN number */
                bin_number?: components["parameters"]["BinNumber"];
                /** @description card last four digits */
                last_four?: components["parameters"]["LastFour"];
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @example 2020-01-01T00:00:00%2B03:00 */
                start_date: components["parameters"]["StartDate"];
                /** @example 2020-01-31T23:59:59%2B03:00 */
                end_date: components["parameters"]["EndDate"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /**
                 * @description payment type code
                 *     - null: All
                 *     - 0: Card
                 *     - 1: Cash
                 *     - 2: Wire Transfer
                 *     - 3: POS
                 *     - 4: SMS
                 *     - 6: Postal Check
                 *     - 7: Paypal
                 *     - 8: BKM Express
                 *     - 9: iDEAL
                 *     - 10: Pay With Iyzico
                 */
                payment_method?: components["parameters"]["PaymentMethod"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DonationListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createDonation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateDonationRequest"];
        responses: {
            200: components["responses"]["CreateDonationResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDonationReport: {
        parameters: {
            query: {
                /** @example 2020-01-01T00:00:00%2B03:00 */
                start_date: components["parameters"]["StartDate"];
                /** @example 2020-01-31T23:59:59%2B03:00 */
                end_date: components["parameters"]["EndDate"];
                /** @description currency id */
                currency_id?: number;
                /**
                 * @description report type
                 *     - 1: donation category
                 *     - 2: fundraising page
                 *     - 3: fundraising campaign
                 *     - 4: added by user
                 *     - 5: donation form
                 *     - 6: monthly donation status
                 *     - 7: association campaign target
                 *     - 8: fundraising team
                 *     - 9: fundraising team campaign
                 *     - 10: face to face group
                 *     - 11: face to face group member
                 */
                report_type?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
                /** @description aggregate results */
                aggregate?: "true" | "false";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description API result containing the report data */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Total amount of all aggregated items (if aggregate is true) */
                        ts?: number;
                        /** @description Total count of all aggregated items (if aggregate is true) */
                        tc?: number;
                        /** @description Total unique users of all aggregated items (if aggregate is true) */
                        tu?: number;
                        /** @description Listed report groups (returned when aggregate is false) */
                        list?: ({
                            /** @description Total amount of the group */
                            ts?: number;
                            /** @description Total count of the group */
                            tc?: number;
                            /** @description Total unique users of the group */
                            tu?: number;
                            /** @description Donation category name */
                            sub_donation_type__name?: string;
                            /** @description Fundraising page title */
                            fundraising_page__title?: string;
                            /** @description Fundraising campaign title */
                            fundraising_campaign__title?: string;
                            /** @description Added by user ID */
                            added_by_id?: number;
                            /** @description Added by user name */
                            added_by__name?: string;
                            /** @description Donation form title */
                            module__title?: string;
                            /** @description Recurring donation status */
                            status?: number;
                            /** @description Recurring donation sub status */
                            sub_status?: number;
                            /** @description Association campaign target title */
                            fundraising_campaign__association_campaign_target__title?: string;
                            /** @description Fundraising team title */
                            fundraising_campaign__team__title?: string;
                            /** @description Fundraising team campaign title */
                            fundraising_campaign__team_campaign__title?: string;
                            /** @description Face to face group name */
                            f2f_group__name?: string;
                        } & {
                            [key: string]: unknown;
                        })[];
                    };
                };
            };
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDonationDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DonationDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteDonation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getMicroDonationList: {
        parameters: {
            query: {
                /** @description what kind of Microdonations should be listed */
                status: "paid" | "refund" | "failed";
                /** @description which values should be listed */
                list?: ("details" | "name_surname" | "address" | "amount" | "sub_donation_type" | "birthday" | "email_status" | "complete_date" | "fundraising_campaign" | "tckno" | "tax_department" | "phone" | "donation_page" | "module" | "payment_method" | "added_by_id" | "f2f_group_id" | "fonzip_id" | "recurring_order_id" | "recurring_withdraw_count" | "recurring_total_withdraw_count" | "recurring_total_withdraw_amount" | "transaction_id" | "provision_no" | "auth_code" | "reference_id" | "ip_address" | "fundraising_campaign_user" | "api_tracking_id" | "news_via_phone" | "news_via_sms" | "news_via_email" | "application" | "card_number" | "receipt_no" | "donor_type" | "amount_visible" | "name_hidden" | "message" | "show_message" | "referring_name" | "referring_email" | "referring_phone" | "bank_account__name" | "payment_settings__name" | "recurring_cancel_reason" | "recurring_cancel_date" | "recurring_start_date" | "recurring_stop_date" | "cancelled_by_id")[];
                /** @description donation category id, null for all */
                category_id?: number;
                /** @description when true, return only donations that have no donation category assigned. Ignored if category_id is also supplied. */
                no_category?: boolean;
                /** @description donation page id */
                donation_page?: number;
                /** @description fundraising campaign id */
                fundraising_campaign?: number;
                /** @description fundraising event id */
                association_campaign_target?: number;
                /** @description payment settings id */
                payment_settings_id?: number;
                /** @description bank account id */
                bank_account_id?: number;
                /** @description API Tracking ID */
                api_tracking_id?: string;
                /** @description ordering */
                order_by?: "name" | "-name" | "transaction__amount" | "-transaction__amount" | "transaction__complete_date" | "-transaction__complete_date";
                recurring?: 1 | 0 | -1;
                donor_type?: null | "personal" | "corporate";
                /** @description payment/debt amount */
                amount?: components["parameters"]["Amount"];
                /**
                 * @description amount condition if amount filter is present
                 *     - null: equals to amount
                 *     - !=: not equals to amount
                 *     - <: smaller than amount
                 *     - <=: smaller and equal to amount
                 *     - \>: bigger than amount
                 *     - \>=: bigger and equal to amount
                 */
                amt_cnd?: components["parameters"]["AmountCondition"];
                /** @description card BIN number */
                bin_number?: components["parameters"]["BinNumber"];
                /** @description card last four digits */
                last_four?: components["parameters"]["LastFour"];
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @example 2020-01-01T00:00:00%2B03:00 */
                start_date: components["parameters"]["StartDate"];
                /** @example 2020-01-31T23:59:59%2B03:00 */
                end_date: components["parameters"]["EndDate"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /**
                 * @description payment type code
                 *     - null: All
                 *     - 0: Card
                 *     - 1: Cash
                 *     - 2: Wire Transfer
                 *     - 3: POS
                 *     - 4: SMS
                 *     - 6: Postal Check
                 *     - 7: Paypal
                 *     - 8: BKM Express
                 *     - 9: iDEAL
                 *     - 10: Pay With Iyzico
                 */
                payment_method?: components["parameters"]["PaymentMethod"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DonationListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getMicroDonationDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DonationDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDonationPageList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /** @description donation pages' donation category id */
                category_id?: number;
                /** @description donation pages' payment settings id */
                payment_settings_id?: number;
                /**
                 * @description Ordering.
                 *
                 *     `order` is the manual order set in the console, the order donation pages
                 *     appear in on the organization's site menu. It is the default, and an unknown
                 *     value falls back to it. Ties are broken by `id`.
                 *
                 *     `title` sorts are case-insensitive. The other sorts break ties by title, then
                 *     `id`. `last_donation_date` lists pages that never received a donation last in
                 *     both directions.
                 */
                order_by?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DonationPageListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDonationFormList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /** @description donation forms' donation category id */
                category_id?: number;
                /** @description donation forms' payment settings id */
                payment_settings_id?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DonationFormListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getMembershipDuesList: {
        parameters: {
            query: {
                /**
                 * @description what kind of membership dues should be listed
                 *     - paid: for payments
                 *     - refund: for refunds
                 *     - failed: for failed payment transactions
                 */
                status: "paid" | "refund" | "failed";
                /** @description Dues Period Year */
                period_year?: number;
                /** @description Dues Period Month */
                period_month?: number;
                /** @description payment/debt amount */
                amount?: components["parameters"]["Amount"];
                /**
                 * @description amount condition if amount filter is present
                 *     - null: equals to amount
                 *     - !=: not equals to amount
                 *     - <: smaller than amount
                 *     - <=: smaller and equal to amount
                 *     - \>: bigger than amount
                 *     - \>=: bigger and equal to amount
                 */
                amt_cnd?: components["parameters"]["AmountCondition"];
                /** @description card BIN number */
                bin_number?: components["parameters"]["BinNumber"];
                /** @description card last four digits */
                last_four?: components["parameters"]["LastFour"];
                /** @description installment count */
                installment_count?: number;
                /** @description Tag id of user */
                tag_id?: number;
                /** @description ordering */
                order_by?: "id" | "-id" | "user__name" | "-user__name" | "transaction__amount" | "-transaction__amount" | "transaction__complete_date" | "-transaction__complete_date";
                /** @description Membership number of user */
                membership_no?: number;
                /** @description User id who added the payment */
                added_by_id?: number;
                /** @description User name (case-insensitive, unaccented) who added the payment. Used when added_by_id is not known. */
                added_by__name?: string;
                /** @description Record creation date filter */
                create_date?: string;
                /** @description Record creation date filter condition */
                create_date_cnd?: null | "<" | ">";
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @example 2020-01-01T00:00:00%2B03:00 */
                start_date: components["parameters"]["StartDate"];
                /** @example 2020-01-31T23:59:59%2B03:00 */
                end_date: components["parameters"]["EndDate"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /**
                 * @description payment type code
                 *     - null: All
                 *     - 0: Card
                 *     - 1: Cash
                 *     - 2: Wire Transfer
                 *     - 3: POS
                 *     - 4: SMS
                 *     - 6: Postal Check
                 *     - 7: Paypal
                 *     - 8: BKM Express
                 *     - 9: iDEAL
                 *     - 10: Pay With Iyzico
                 */
                payment_method?: components["parameters"]["PaymentMethod"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["MembershipDuesListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getMembershipDueDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                subscription_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["MembershipDueDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteMembershipDue: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                subscription_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getMembershipDueDebtsList: {
        parameters: {
            query: {
                /**
                 * @description what kind of membership due debts should be listed
                 *     - null: All records
                 *     - 1: Nonpaid debt
                 *     - 6: Removed/Inactive debt
                 *     - 8: Paid debt
                 */
                status?: null | 1 | 6 | 8;
                /** @description Dues Period Year */
                period_year?: number;
                /** @description Dues Period Month */
                period_month?: number;
                /** @description payment/debt amount */
                amount?: components["parameters"]["Amount"];
                /**
                 * @description amount condition if amount filter is present
                 *     - null: equals to amount
                 *     - !=: not equals to amount
                 *     - <: smaller than amount
                 *     - <=: smaller and equal to amount
                 *     - \>: bigger than amount
                 *     - \>=: bigger and equal to amount
                 */
                amt_cnd?: components["parameters"]["AmountCondition"];
                /** @description Membership Due Operation Date */
                operation_date?: string;
                /**
                 * @description Start of an operation date range, sent with end_date (one without the other is a 400).
                 *     A date-time with an offset is that instant; a bare YYYY-MM-DD is the start of that day
                 *     in the organization's timezone.
                 * @example 2026-09-01T00:00:00%2B03:00
                 */
                start_date?: string;
                /**
                 * @description End of an operation date range, sent with start_date. Inclusive: a bare YYYY-MM-DD
                 *     covers that whole day in the organization's timezone.
                 * @example 2026-09-30T23:59:59%2B03:00
                 */
                end_date?: string;
                /** @description Membership number of user */
                membership_no?: number;
                /** @description Tag id of user */
                tag_id?: number;
                /** @description User id who added the debt */
                added_by_id?: number;
                /** @description User name (case-insensitive, unaccented) who added the debt. Used when added_by_id is not known. */
                added_by__name?: string;
                /** @description Record creation date filter */
                create_date?: string;
                /** @description Record creation date filter condition */
                create_date_cnd?: null | "<" | ">";
                /**
                 * @description Start of a record creation date range, sent with create_end_date (one without the
                 *     other is a 400). Read like start_date.
                 * @example 2026-09-01T00:00:00%2B03:00
                 */
                create_start_date?: string;
                /**
                 * @description End of a record creation date range, sent with create_start_date. Inclusive, read
                 *     like end_date.
                 * @example 2026-09-30T23:59:59%2B03:00
                 */
                create_end_date?: string;
                /**
                 * @description When true, returns only debts whose (user, period, amount, debt category)
                 *     appears more than once in the association's debts. Two debts in different
                 *     categories are not duplicates.
                 */
                possible_duplicate?: boolean;
                /**
                 * @description Debt category ids; repeat the parameter for several (`?debt_category_id=3&debt_category_id=5`).
                 *     A deleted category still filters: debts keep a category until it is moved.
                 *     Another organisation's id matches nothing.
                 */
                debt_category_id?: number[];
                /**
                 * @description When true, returns debts without a category. Together with `debt_category_id`,
                 *     a debt matching either is returned.
                 */
                no_debt_category?: boolean;
                /** @description ordering */
                order_by?: "id" | "-id" | "period" | "-period" | "amount" | "-amount" | "operation_date" | "-operation_date" | "create_date" | "-create_date";
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["MembershipDueDebtListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDebtDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                debt_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DebtDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateDebt: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                debt_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["UpdateDebt"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteDebt: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                debt_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateDebtStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                debt_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["UpdateDebtStatus"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createDebt: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateDebt"];
        responses: {
            200: components["responses"]["CreateDebtSuccess"];
            400: components["responses"]["CreateDebtFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["CreateDebtFailed"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDebtCategoryList: {
        parameters: {
            query: {
                /** @description Part of the category name, ignoring case and Turkish accents */
                query?: string;
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DebtCategoryListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createDebtCategory: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["DebtCategoryName"];
        responses: {
            200: components["responses"]["DebtCategoryResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDebtCategoryUsage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DebtCategoryUsageResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateDebtCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["DebtCategoryName"];
        responses: {
            200: components["responses"]["DebtCategoryResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteDebtCategory: {
        parameters: {
            query?: {
                /**
                 * @description For clients that send no body with DELETE. An empty value means no category.
                 *     Ignored when a JSON body is sent.
                 */
                replacement_id?: string;
            };
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["DeleteDebtCategory"];
        responses: {
            200: components["responses"]["DebtCategoryDeleteResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            409: components["responses"]["DebtCategoryInUse"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getDonationCategoryList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["DonationCategoryListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createDonationCategory: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateUpdateCategory"];
        responses: {
            200: components["responses"]["CreateCategorySuccess"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateDonationCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateUpdateCategory"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteDonationCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateDonationCategoryStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["UpdateStatus"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getEventList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /**
                 * @description filter based on past or upcoming events
                 *     - a: all
                 *     - p: past
                 *     - u: upcoming
                 */
                target?: "a" | "p" | "u";
                /** @description ordering */
                order_by?: "start_date" | "-start_date" | "name" | "-name" | "id" | "-id";
                /** @description true for archived records, null for normal records */
                archived?: null | "true";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EventListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getEventDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EventDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateEvent"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateEventStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["UpdateEventStatus"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createEvent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateEvent"];
        responses: {
            200: components["responses"]["CreateEventResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getTicketDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EventTicketDetail"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateTicket: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateEventTicket"];
        responses: {
            200: components["responses"]["EventTicketDetail"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteTicket: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createTicket: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateEventTicket"];
        responses: {
            200: components["responses"]["EventTicketDetail"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getTicketSaleList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @example 2020-01-01T00:00:00%2B03:00 */
                start_date: components["parameters"]["StartDate"];
                /** @example 2020-01-31T23:59:59%2B03:00 */
                end_date: components["parameters"]["EndDate"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /**
                 * @description payment type code
                 *     - null: All
                 *     - 0: Card
                 *     - 1: Cash
                 *     - 2: Wire Transfer
                 *     - 3: POS
                 *     - 4: SMS
                 *     - 6: Postal Check
                 *     - 7: Paypal
                 *     - 8: BKM Express
                 *     - 9: iDEAL
                 *     - 10: Pay With Iyzico
                 */
                payment_method?: components["parameters"]["PaymentMethod"];
                /** @description date time range selection, 0 for date range selection (start_date & end_date must be present),  1 for all time (event_id must be present). */
                time_selection?: 0 | 1;
                /** @description to filter sales depending on event */
                event_id?: number;
                /** @description payment/debt amount */
                amount?: components["parameters"]["Amount"];
                /**
                 * @description amount condition if amount filter is present
                 *     - null: equals to amount
                 *     - !=: not equals to amount
                 *     - <: smaller than amount
                 *     - <=: smaller and equal to amount
                 *     - \>: bigger than amount
                 *     - \>=: bigger and equal to amount
                 */
                amt_cnd?: components["parameters"]["AmountCondition"];
                /** @description card BIN number */
                bin_number?: components["parameters"]["BinNumber"];
                /** @description card last four digits */
                last_four?: components["parameters"]["LastFour"];
                /** @description installment count */
                installment_count?: number;
                /** @description payment system id */
                payment_settings_id?: number;
                /** @description what kind of ticket sales should be listed */
                status: "paid" | "refund" | "failed";
                /** @description ordering */
                order_by?: "id" | "-id" | "transaction__amount" | "-transaction__amount" | "transaction__complete_date" | "-transaction__complete_date";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["TicketSaleListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getTicketSaleDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_sale_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["TicketDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFundraisingCampaignList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /** @description ordering */
                order_by?: "user__name" | "-user__name" | "title" | "-title" | "create_date" | "-create_date" | "activation_date" | "-activation_date" | "donation_total" | "-donation_total";
                /**
                 * @description fundraising campaign status list
                 *     - 0: waiting approval
                 *     - 1: approved
                 *     - 2: rejected
                 *     - 3: finalized
                 *     - 4: deleted
                 *     - 5: waiting extra approval
                 *     - 7: archived
                 */
                status?: (0 | 1 | 7 | 2 | 3 | 4 | 5)[];
                /** @description fundraising campaigns' donation category id */
                category_id?: number;
                /** @description fundraising campaign teams' campaign id */
                team_campaign_id?: number;
                /** @description fundraising campaigns' payment settings id */
                payment_settings_id?: number;
                /** @description fundraising campaigns' fundraising event id */
                association_campaign_target_id?: number;
                /** @description create date filter */
                create_date?: string;
                /** @description create date filter condition */
                create_date_cnd?: null | "<" | ">";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FundraisingCampaignListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createFundraisingCampaign: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["FundraisingCampaign"];
        responses: {
            200: components["responses"]["CreateFundraisingCampaignResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFundraisingCampaignDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                campaign_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FundraisingCampaignDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateFundraisingCampaign: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                campaign_id: number;
            };
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["FundraisingCampaignUpdate"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteFundraisingCampaign: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                campaign_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateFundraisingCampaignStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                campaign_id: number;
            };
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["UpdateFundraisingCampaignStatus"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFundraisingEvents: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FundraisingEventListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateFundraisingEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["FundraisingEvent"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteFundraisingEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createFundraisingEvent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["FundraisingEvent"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFundraisingTeams: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /** @description ordering */
                order_by?: "title" | "-title" | "create_date" | "-create_date" | "user__name" | "-user__name" | "-id" | "id";
                /**
                 * @description fundraising team status
                 *     - 0: waiting approval
                 *     - 1: approved
                 *     - 2: rejected
                 *     - 3: waiting extra approval
                 *     - 4: deleted
                 *     - 5: archived
                 */
                status?: 0 | 1 | 2 | 3 | 4 | 5;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FundraisingTeamListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createFundraisingTeam: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateFundraisingTeam"];
        responses: {
            200: components["responses"]["CreateFundraisingTeamResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFundraisingTeamDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                team_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FundraisingTeamDetailResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateFundraisingTeam: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                team_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["UpdateFundraisingTeam"];
        responses: {
            200: components["responses"]["EmptyResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteFundraisingTeam: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                team_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EmptyResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFundraisingTeamsCampaigns: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                team_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FundraisingTeamCampaignListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createFundraisingTeamCampaign: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                team_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateUpdateFundraisingTeamCampaign"];
        responses: {
            200: components["responses"]["CreateUpdateFundraisingTeamCampaignResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateFundraisingTeamCampaign: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                team_id: number;
                campaign_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateUpdateFundraisingTeamCampaign"];
        responses: {
            200: components["responses"]["CreateUpdateFundraisingTeamCampaignResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteFundraisingTeamCampaign: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                team_id: number;
                campaign_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EmptyResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFormList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /** @description true for archived records, null for normal records */
                archived?: null | "true";
                /**
                 * @description Ordering.
                 *
                 *     `order` is the manual order set in the console, the order forms appear in on
                 *     the organization's site menu. It is the default, and an unknown value falls
                 *     back to it. Ties are broken by `id`.
                 *
                 *     `title` sorts are case-insensitive. The other sorts break ties by title, then
                 *     `id`. `last_answer_date` lists forms that were never answered last in both
                 *     directions. `response_count` and `waiting_approval` sort by the numbers the
                 *     list returns for each form. Works together with `archived`.
                 */
                order_by?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FormListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFormAnswerList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @example 2020-01-01T00:00:00%2B03:00 */
                start_date: components["parameters"]["StartDate"];
                /** @example 2020-01-31T23:59:59%2B03:00 */
                end_date: components["parameters"]["EndDate"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                status: "answer" | "waiting_approval" | "rejected" | "refund" | "failed";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FormAnswerListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getFormAnswerDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                form_id: number;
                answer_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["FormAnswerDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    respondFormAnswer: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                form_id: number;
                answer_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["RespondFormAnswer"];
        responses: {
            200: components["responses"]["RespondFormAnswerResult"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getEcardList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                listing?: 0 | 1 | 2;
                /** @description filter based on ecard category id */
                category_id?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EcardListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getEcardDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ecard_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EcardDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getEcardCategoryList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EcardCategoryListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createEcardCategory: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateUpdateCategory"];
        responses: {
            200: components["responses"]["CreateCategorySuccess"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateEcardCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody: components["requestBodies"]["CreateUpdateCategory"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteEcardCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getEcardTransactionList: {
        parameters: {
            query: {
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @example 2020-01-01T00:00:00%2B03:00 */
                start_date: components["parameters"]["StartDate"];
                /** @example 2020-01-31T23:59:59%2B03:00 */
                end_date: components["parameters"]["EndDate"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /**
                 * @description payment type code
                 *     - null: All
                 *     - 0: Card
                 *     - 1: Cash
                 *     - 2: Wire Transfer
                 *     - 3: POS
                 *     - 4: SMS
                 *     - 6: Postal Check
                 *     - 7: Paypal
                 *     - 8: BKM Express
                 *     - 9: iDEAL
                 *     - 10: Pay With Iyzico
                 */
                payment_method?: components["parameters"]["PaymentMethod"];
                /** @description payment/debt amount */
                amount?: components["parameters"]["Amount"];
                /**
                 * @description amount condition if amount filter is present
                 *     - null: equals to amount
                 *     - !=: not equals to amount
                 *     - <: smaller than amount
                 *     - <=: smaller and equal to amount
                 *     - \>: bigger than amount
                 *     - \>=: bigger and equal to amount
                 */
                amt_cnd?: components["parameters"]["AmountCondition"];
                /** @description card BIN number */
                bin_number?: components["parameters"]["BinNumber"];
                /** @description card last four digits */
                last_four?: components["parameters"]["LastFour"];
                status?: "paid" | "refund" | "failed";
                /**
                 * @description *(paid only)* filter based on cargo status
                 *     - null: all
                 *     - 0: will not be sent
                 *     - 1: waiting to be prepared
                 *     - 2: waiting for cargo info
                 *     - 3: posted
                 *     - 4: waiting to be prepared **or** waiting for cargo info (1 and 2 combined)
                 */
                cargo_status?: 0 | 1 | 2 | 3 | 4;
                /**
                 * @description Ordering: one of the sale's own columns below, or the transaction's
                 *     `transaction__amount`, `transaction__complete_date` or
                 *     `transaction__refund_date`; a leading `-` sorts descending. Any
                 *     other value, a related field included, is refused with HTTP 403.
                 *     Rows are always tie-broken by `id`.
                 *
                 *     The default depends on `status`: `-transaction__refund_date` for
                 *     `refund`, `-transaction__complete_date` for `paid` and `failed`.
                 *
                 *     *(paid only)* `first_name` / `-first_name` additionally sorts by
                 *     `last_name` with the same direction.
                 */
                order_by?: string;
                /** @description *(paid only)* filter sales on e-Card id */
                ecard_id?: number;
                /** @description *(paid only)* payment settings id */
                payment_settings_id?: number;
                /** @description *(paid only)* bank account id */
                bank_account_id?: number;
                /** @description *(paid only)* filter transactions on currency id */
                currency_id?: number;
                /**
                 * @description *(paid only)* filter on the requested billing information type
                 *     - 0: no bill
                 *     - 1: personal
                 *     - 2: corporate
                 */
                bill_type?: 0 | 1 | 2;
                /**
                 * @description *(paid only)* Return only transactions scheduled for future
                 *     delivery (`delivery_time_mode` 1 or 2) whose delivery date - either
                 *     on the transaction itself or on one of its recipients - equals this
                 *     date. Sent as a date-time; it is converted to the association
                 *     timezone and compared as a date.
                 */
                delivery_date?: string;
                /**
                 * @description *(paid only)* filter card payments on the issuing bank's country,
                 *     relative to the association's own country. Any other value is
                 *     rejected with HTTP 400.
                 *     - 1: local (issued in the association's country)
                 *     - 2: abroad
                 *     - 3: unknown (BIN not recognised)
                 */
                card_country?: 1 | 2 | 3;
                /**
                 * @description *(paid only)* filter card payments on card type. Any other value is
                 *     rejected with HTTP 400.
                 *     - 1: credit
                 *     - 2: debit
                 *     - 3: prepaid
                 *     - 4: unknown (BIN not recognised)
                 */
                card_type?: 1 | 2 | 3 | 4;
                /**
                 * @description *(paid only)* Filter e-card transactions whose marketing channel
                 *     `utm_source` matches one of the supplied values (IN-list). Repeat
                 *     the parameter to supply multiple values, e.g.
                 *     `?utm_source=google&utm_source=bing`.
                 */
                utm_source?: string[];
                /** @description *(paid only)* Filter e-card transactions by one or more `utm_medium` values (IN-list). */
                utm_medium?: string[];
                /** @description *(paid only)* Filter e-card transactions by one or more `utm_campaign` values (IN-list). */
                utm_campaign?: string[];
                /** @description *(paid only)* Filter e-card transactions by one or more `utm_content` values (IN-list). */
                utm_content?: string[];
                /**
                 * @description *(paid only)* When true, return only e-card transactions with no
                 *     marketing channel attached (organic / direct traffic). Mutually
                 *     exclusive with the four UTM filters above — when set, those are
                 *     ignored.
                 */
                marketing_channel_null?: boolean;
                /**
                 * @description *(paid only)* Selects the optional fields returned for each
                 *     transaction. Repeat the parameter to request several fields, e.g.
                 *     `?list=ecard&list=amount&list=category`.
                 *
                 *     Every response always contains this base set, whatever `list`
                 *     holds: `id`, `user_id`, `first_name`, `last_name`, `email`,
                 *     `phone`, `certificate_id`, `certificate_file`, `zip_file`,
                 *     `cargo_status`, `cargo_company`, `cargo_number`,
                 *     `recipient_count`, `transaction__payment_status` and
                 *     `transaction__fonzip_framework`.
                 *
                 *     When `list` is **omitted**, a default set is appended to the base
                 *     set: `certificate__title`, `transaction__amount`,
                 *     `transaction__currency__display`,
                 *     `transaction__currency__iso_code`, `transaction__payment_method`,
                 *     `transaction__complete_date`, `delivery_time_mode`,
                 *     `delivery_date`, `sent_mail_id`, `sent_mail__message_id`,
                 *     `sent_mail__status`, `sent_mail_to_referring_id`,
                 *     `sent_mail_to_referring__message_id` and
                 *     `sent_mail_to_referring__status`. Sending `list` replaces that
                 *     default set - only the fields you request are added.
                 *
                 *     Some values expand to more than one response field:
                 *     - `ecard` → `certificate__title`
                 *     - `amount` → `transaction__amount`, `transaction__currency__display`, `transaction__currency__iso_code`
                 *     - `email_status` → `sent_mail_id`, `sent_mail__message_id`, `sent_mail__status`, `sent_mail_to_referring_id`, `sent_mail_to_referring__message_id`, `sent_mail_to_referring__status`
                 *     - `card_number` → `transaction__bin_number`, `transaction__last_four`
                 *     - `delivery_date` → `delivery_time_mode`, `delivery_date`
                 *     - `added_by_id` → `added_by_id`, `added_by__name`
                 *     - `category` → `certificate__categories__name` (array of category names)
                 *
                 *     The four `marketing_channel__utm_*` values return the UTM tags of
                 *     the transaction's marketing channel, and are `null` for organic /
                 *     direct traffic. They are returned only when requested here -
                 *     filtering on `utm_source` & co. does not add them to the response.
                 *
                 *     Values in the `complete_date` … `bank_account__name` group are
                 *     returned prefixed with `transaction__` (e.g. `list=fonzip_id`
                 *     returns `transaction__fonzip_id`). All remaining values are
                 *     returned under their own name. Unknown values are ignored.
                 */
                list?: string[];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EcardTransactionListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getEcardTransactionDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sale_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["EcardTransactionDetailsResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteEcardTransaction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sale_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getPaymentSystemsList: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["PaymentSystemListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getBankAccountList: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["BankAccountListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getBankAccountTransactionList: {
        parameters: {
            query: {
                /** @example 2020-01-01T00:00:00%2B03:00 */
                start_date: components["parameters"]["StartDate"];
                /** @example 2020-01-31T23:59:59%2B03:00 */
                end_date: components["parameters"]["EndDate"];
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /**
                 * @description Filter by reconciliation state. Omit for all.
                 *     * `3` - matched to a record
                 *     * `8` - waiting to be matched
                 *     * `9` - will not be matched
                 */
                payment_status?: 3 | 8 | 9;
                /**
                 * @description Filter by what a matched transfer became. Only meaningful together with
                 *     `payment_status=3`; unmatched transfers have no type yet.
                 *     * `1` - donation
                 *     * `2` - membership dues
                 *     * `4` - e-card
                 */
                transaction_type?: 1 | 2 | 4;
            };
            header?: never;
            path: {
                /** @description Bank account whose incoming transfers are listed */
                account_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["BankAccountTransactionListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getMarketingChannelList: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["MarketingChannelListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getMarketingChannelFilterValues: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["MarketingChannelFilterValuesResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    listTemplates: {
        parameters: {
            query: {
                /** @description start page of records */
                start_page: components["parameters"]["StartPage"];
                /** @description How many records should be listed */
                how_many: components["parameters"]["HowMany"];
                /** @description search parameter. start with - (minus) char to exclude searched text */
                query?: components["parameters"]["Query"];
                /** @description template type filter */
                template_type?: "e" | "s";
                /** @description template category id */
                category_id?: number;
                /** @description order by */
                order_by?: "title" | "-title" | "create_date" | "-create_date";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["TemplateListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["Template"];
        responses: {
            200: components["responses"]["CreateTemplateSuccess"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getTemplateDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["TemplateDetails"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["Template"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            409: components["responses"]["TemplateInUse"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    listWebhooks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["WebhookListResponse"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    createWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["Webhook"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    getWebhookDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                webhook_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["WebhookDetails"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    updateWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                webhook_id: number;
            };
            cookie?: never;
        };
        requestBody?: components["requestBodies"]["Webhook"];
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    deleteWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                webhook_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
    sendWebhookTestNotification: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                webhook_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Success"];
            400: components["responses"]["OperationFailed"];
            401: components["responses"]["UnauthorizedAccess"];
            402: components["responses"]["NoValidPlan"];
            403: components["responses"]["NoPermission"];
            404: components["responses"]["ObjectNotFound"];
            405: components["responses"]["InvalidRequest"];
            429: components["responses"]["RateLimitExceeded"];
            501: components["responses"]["NotImplemented"];
        };
    };
}
