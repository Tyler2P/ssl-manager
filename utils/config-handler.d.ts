type SiteTheme = "light" | "dark" | "system";

interface ConfigFile_User {
  id: string;
  username: string;
  password: string;
}
interface ConfigFile {
  resetDefaults: boolean;
  rootUser: ConfigFile_User;
  theme: SiteTheme;
  defaultProfile: number;
  defaultUserPermissions: number | bigint;
  maximumUserPermissions: number | bigint;
  allowRegistrations: boolean;
  forceMFA: boolean;
}

/**
 * Test whether the config file is setup properly
 * @returns {boolean} Whether the config file is setup
 */
export function test(): boolean;

/**
 * Check whether the config file exists
 * @returns {boolean} Whether the config file exists
 */
export function exists(): boolean;

/**
 * Load contents of the config file into an object
 * @returns {object} The config file
 */
export function load(): ConfigFile;

/**
 * Write the config file
 * @param {object} config The configuration object
 */
export function write(config: ConfigFile): void;