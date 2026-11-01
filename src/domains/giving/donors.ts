import type { Row } from "../../store/collection";
import type { UserRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { newUser } from "../../store/users";

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
  return store.users.insert(
    newUser({
      corporate_type: contact.corporate,
      first_name: contact.firstName,
      last_name: contact.lastName,
      address: contact.address,
      birthday: contact.birthday,
      email: contact.email,
      phone: contact.phone,
      membership_no: membershipNo,
      tckno: contact.tckno,
      apply_date: joinedAt,
      join_date: joinedAt,
      post_code: contact.postCode,
      district_text: contact.district,
      city_text: contact.city,
    }),
  );
}
