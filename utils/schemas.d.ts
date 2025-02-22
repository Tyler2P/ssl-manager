interface UserSchema {
  user_id: string;
  last_seen: Date | null;
  joined_at: Date;
  fName: string;
  sName: string;
  username: string;
  email: string | null;
  phone_num: string | null;
  password: string;
  reset_password: 0 | 1;
  password_update_date: Date;
  permissions: BigInt;
  second_verification_enabled: 0 | 1;
  second_verification_token	: string | null;
  disabled: 0 | 1;
  controlled_by: number;
  third_party_id: string | null;
}
interface UserGroupsSchema {
  user_id: string;
  group_id: string;
  joined_at: Date | null;
}
interface UserSchema_IncludePreferences extends UserSchema {
  ssl_expiry_email: 0 | 1;
  ssl_renewed_email: 0 | 1;
  ssl_error_email: 0 | 1;
  dns_error_email: 0 | 1;
  user_create_email: 0 | 1;
  user_delete_email: 0 | 1;
  user_update_email: 0 | 1;
}
interface UserSchema_IncludeGroups extends UserSchema {
  groups: {
    group_id: string;
    joined_at: Date | null;
  }[];
}

interface GroupSchema {
  group_id: string;
  created_at: Date | null;
  created_by: string | null;
  name: string;
  description: string | null;
  notes: string | null;
  permissions: bigint;
  disabled: 0 | 1;
  controlled_by: number;
  third_party_id: string | null;
}
interface AuthServicesSchema {
  id: number;
  name: string;
  description: string | null;
  notes: string | null;

  provider: string;
  api_key: string | null;
  url: string | null;
  bk_url: string | null;
  username: string | null;
  password: string | null;

  use_start_tls: 0 | 1;
  use_tls: 0 | 1;
  skip_tls_verification: 0 | 1;
  username_format: 0 | 1;

  user_search_filter: string | null;
  group_search_filter: string | null;
}
interface AuthServicesGroupsSchema {
  id: number;
  auth_service: number;
  name: string;
  group_search_filter: string | null;
}
interface DnsProfilesSchema {
  id: number;
  name: string;
  description: string | null;
  provider: string;
  api_key: string | null;
  api_url: string | null;
}
interface ArchivedEmailsSchema {
  email_id: string;
  created_at: string;
  sent_at: string | null;
  status: number;
  fail_reason: string | null;
  attempts: number;
}
interface ScheduledEmailsSchema {
  email_id: string;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  status: number;
  fail_reason: string | null;
  retries: number;
}