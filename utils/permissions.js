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
const PermissionFlags = {
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

const DefaultBit = BigInt(0);

class PermissionBitfield {
  /**
   * Construct thew class
   * @param {bigint} bitfield The permission bitfield
   */
  constructor(bitfield) {
    if (typeof bitfield !== "bigint" && !Array.isArray(bitfield))
      throw new TypeError(`Typeof bitfield must be bigint, received ${typeof bitfield}`);

    this.bitfield = this.resolve(bitfield);
  }
  
  /**
   * Checks whether the bitfield has a permission
   * @param {string} permission The permission to check for
   * @returns {boolean} Whether the bitfield contains the permission
   */
  has(permission) {
    // Ensure the provided permission is a valid permission
    if (!PermissionFlags[permission]) return false;
    // Get the bit of the permission
    let bit = this.resolve(permission);
    // Return if the bitfield contains the permission bit
    return (BigInt(this.bitfield) & bit) === bit;
  }

  /**
   * Checks whether the bitfield any of the following permissions
   * @param {Array<string>} permissions The permissions to check for
   * @returns {boolean} Whether the bitfield contains any of the permissions
   */
  hasAny(...permissions) {
    let containsPermission = false;

    permissions.forEach((permission) => {
      // Ensure the provided permission is a valid permission
      if (!PermissionFlags[permission]) return;
      // Get the bit of the permission
      let bit = this.resolve(permission);

      // If the bitfield contains the permission, set the flag
      if ((BigInt(this.bitfield) & bit) === bit)
        containsPermission = true;
    });

    return containsPermission;
  }
  
  /**
   * Checks whether the bitfield contains all of the provided permissions
   * @param {Array<string>} permissions The permissions to check for
   * @returns {boolean} Whether the bitfield contains all of the permissions
   */
  hasAll(...permissions) {
    // Check if all provided permissions are present in the bitfield
    return permissions.every(permission => this.has(permission));
  }

  /**
   * Add new permissions to the current permission bitfield
   * @param {Array<string>} newPermissions The array of permissions to add
   * @returns {bigint} The updated permission bitfield
   */
  add(...newPermissions) {
    if (!Array.isArray(newPermissions))
      throw new TypeError("newPermissions must be an array of permissions");

    const updatedPermissions = newPermissions.reduce((accumulator, permission) => {
      const bit = PermissionFlags[permission];

      if (!bit)
        throw new Error(`Invalid permission: ${permission}`);

      return accumulator | bit;
    }, this.bitfield);

    return updatedPermissions;
  }

  /**
   * Remove permissions from the current permission bitfield
   * @param {Array<string>} permissionsToRemove The array of permissions to remove
   * @returns {bigint} The updated permission bitfield
   */
  remove(...permissionsToRemove) {
    if (!Array.isArray(permissionsToRemove))
      throw new TypeError("permissionsToRemove must be an array of permissions");

    const updatedPermissions = permissionsToRemove.reduce((accumulator, permission) => {
      const bit = PermissionFlags[permission];

      if (!bit)
        throw new Error(`Invalid permission: ${permission}`);

      return accumulator & ~bit;
    }, this.bitfield);

    return updatedPermissions;
  }

  /**
   * Resolves bitfields to their numeric form
   * @param {BitFieldResolvable} [bit] bit(s) to resolve
   * @returns {number | bigint} The resolved bit
   */
  resolve(bit) {
    const defaultBit = DefaultBit;

    if (typeof bit === "undefined" && this.bitfield !== undefined) bit = this.bitfield;
    if (typeof defaultBit === typeof bit && bit >= defaultBit) return bit;
    // If the bit is an array, resolve each bit individually
    if (Array.isArray(bit)) return bit.map(p => this.resolve(p)).reduce((prev, p) => prev | p, defaultBit);

    if (typeof bit === "string") {
      if (typeof PermissionFlags[bit] !== "undefined") return PermissionFlags[bit];
      if (!isNaN(bit)) return typeof defaultBit === "bigint" ? BigInt(bit) : Number(bit);
    }
  }

  /**
   * Gets an array of bitfield names based on the permissions available.
   * @returns {string[]} An array of permissions
   */
  toArray() {
    const permissions = [];

    for (const [permission, bit] of Object.entries(PermissionFlags)) {
      if ((this.bitfield & bit) === bit) {
        permissions.push(permission);
      }
    }

    return permissions;
  }
}

module.exports.default = PermissionBitfield;