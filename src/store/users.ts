import type { UserRecord } from "./records";

export type NewUser = Omit<UserRecord, "id">;

export function newUser(fields: Partial<NewUser>): NewUser {
  return {
    corporate_type: false,
    first_name: "",
    last_name: "",
    address: "",
    birthday: "",
    total_financial: 0,
    email: "",
    phone: "",
    membership_no: 0,
    tckno: "",
    apply_date: "",
    join_date: "",
    user_defined_values: {},
    nationality_text: "",
    home_phone_first: "",
    post_code: "",
    district_text: "",
    city_text: "",
    country_text: "",
    work_phone: "",
    work_address: "",
    work_post_code: "",
    private: false,
    work_district_text: "",
    work_city_text: "",
    work_country_text: "",
    email_second: "",
    admin: false,
    profile_pic: null,
    ...fields,
  };
}
