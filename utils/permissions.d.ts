/**
 * ViewLogs: View the logs page in the admin panel
 * InviteUsers: Invite new users to the admin panel
 * ViewUsers: View the users page on the admin panel
 * EditUsers: Edit settings of user accounts
 * DeleteUsers: Delete user accounts
 * ChangeUserPasswords: Change the passwords of other accounts
 * ReceiveAdminAlerts: Receive alert emails (for example, when an SSL certificate is about to expire)
 * ViewSiteSettings: View the site settings page in the admin panel
 * ChangeSiteSettings: Change site settings
*/
declare const PermissionFlags = {
  ViewLogs: 1n << 6n,
  InviteUsers: 1n << 10n,
  ViewUsers: 1n << 11n,
  EditUsers: 1n << 12n,
  DeleteUsers: 1n << 13n,
  ChangeUserPasswords: 1n << 14n,
  ReceiveAdminAlerts: 1n << 16n,
  ViewSiteSettings: 1n << 20n,
  ChangeSiteSettings: 1n << 21n
}

type PermissionFlag = keyof typeof PermissionFlags;

declare class PermissionBitfield {
  /**
   * Construct the class
   * @param bitfield The permission bitfield
   */
  constructor(bitfield: bigint | PermissionFlag[]);

  /**
   * Checks whether the bitfield has a permission
   * @param permission The permission to check for
   * @returns Whether the bitfield contains the permission
   */
  has(permission: PermissionFlag): boolean;

  /**
   * Checks whether the bitfield has any of the following permissions
   * @param permissions The permissions to check for
   * @returns Whether the bitfield contains any of the permissions
   */
  hasAny(...permissions: PermissionFlag[]): boolean;

  /**
   * Checks whether the bitfield contains all of the provided permissions
   * @param permissions The permissions to check for
   * @returns Whether the bitfield contains all of the permissions
   */
  hasAll(...permissions: PermissionFlag[]): boolean;

  /**
   * Add new permissions to the current permission bitfield
   * @param newPermissions The array of permissions to add
   * @returns The updated permission bitfield
   */
  add(...newPermissions: PermissionFlag[]): bigint;

  /**
   * Remove permissions from the current permission bitfield
   * @param permissionsToRemove The array of permissions to remove
   * @returns The updated permission bitfield
   */
  remove(...permissionsToRemove: PermissionFlag[]): bigint;

  /**
   * Resolves bitfields to their numeric form
   * @param bit bit(s) to resolve
   * @returns The resolved bit
   */
  resolve(bit: PermissionFlag | PermissionFlag[] | bigint): number | bigint;

  /**
   * Gets an array of bitfield names based on the permissions available.
   * @returns An array of permissions
   */
  toArray(): PermissionFlag[];
}

export default PermissionBitfield;