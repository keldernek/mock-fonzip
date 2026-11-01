import type { Row } from "../../store/collection";
import type { UserRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";

interface DonorContact {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly tckno: string;
  readonly birthday: string;
  readonly address: string;
  readonly district: string;
  readonly city: string;
  readonly postCode: string;
  readonly corporate: boolean;
}

export function createDonor(
  store: OrgStore,
  contact: DonorContact,
  joinedAt: string,
): Row<UserRecord> {
  const membershipNo =
    store.users
      .list()
      .reduce((highest, user) => Math.max(highest, user.membership_no), 0) + 1;
  return store.users.insert({
    corporate_type: contact.corporate,
    first_name: contact.firstName,
    last_name: contact.lastName,
    address: contact.address,
    birthday: contact.birthday,
    total_financial: 0,
    email: contact.email,
    phone: contact.phone,
    membership_no: membershipNo,
    tckno: contact.tckno,
    apply_date: joinedAt,
    join_date: joinedAt,
    user_defined_values: {},
    nationality_text: "",
    home_phone_first: "",
    post_code: contact.postCode,
    district_text: contact.district,
    city_text: contact.city,
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
  });
}
