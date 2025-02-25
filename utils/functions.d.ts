import { PoolConnection } from "mysql2/promise";
import { UserSchema, UserSchema_IncludePreferences } from "./schemas";

type emailPreferenceTypes = "contact_form_email" | "contact_form_spam_email" | "user_create_email" | "user_delete_email" | "blog_create_email" | "blog_edit_email" | "blog_delete_email" | "blog_spam_email";
type AuthTypes = "Pre-Authorization" | "Authorized" | "Email-Authentication";
type emailBodyTypes = "plain" | "html";
type logTypes = "INFO" | "WARN" | "ERROR";

interface RequestOptions {
  authCookie: Boolean;
  authType: AuthTypes;
  redirectAccountAlterations: boolean;
}
interface RequestReturnsUser {
  user: UserSchema;
  bool: Boolean;
}

interface emailOptions {
  body: emailBodyTypes;
  directory?: String;
  templateVariables: Object;
  bccEnabled: Boolean;
}
interface emailData {
  error: boolean;
  msg?: string;
}

/**
 * Define the database pool
 * @param db The database pool
 */
export function defineDB(db: PoolConnection): void;
/**
 * Get a database connection
 * @returns The database connection
 */
export function getDB(): Promise<PoolConnection>;

/**
 * Validate an email address
 * @param email The email address
 * @returns Whether the string is a valid email address
 */
export function validateEmail(email: string): boolean;
/**
 * Test whether a string contains a number
 * @param string The string to test
 * @returns Whether or not a string contains a number
 */
export function hasNumber(string: string): boolean;
/**
   * Test whether a string contains an uppercase character
   * @param string The string to test
   * @returns Whether the string contains an uppercase character
   */
export function stringHasUppercase(string: string): boolean;

/**
 * Format text for console logging
 * @param type The type of log
 * @param text The text to log
 * @returns The formatted log
 */
export function formatLog(type: logTypes, text: string): string;

/**
 * Generate a secure ID
 * @param length The length of the ID
 * @returns The generated ID
 */
export function generateId(length: number): string;

/**
 * Check if a user is allowed to access an endpoint & the server is ready
 * @param req The incoming HTTP request
 * @param res The HTTP response
 * @param options The endpoints options
 */
export function checkRequest(req: Request, res: Response, options: RequestOptions, requestUser: true): Promise<RequestReturnsUser>;
export function checkRequest(req: Request, res: Response, options: RequestOptions, requestUser: false): Promise<Boolean>;
export function checkRequest(req: Request, res: Response, options: RequestOptions, requestUser: boolean): Promise<Boolean>;

/**
 * Send a HTML response to an incoming HTTP request
 * @param req The request object to the incoming HTTP request
 * @param res The response to the incoming HTTP request
 * @param page The page to render
 * @param options The render options
 */
export function sendPage(req: Request, res: Response, page: string, options: object): void;

/**
 * Send an email
 * @param to The email address to send the email to
 * @param subject The email subject
 * @param content The email content
 * @param path The file path to a HTML email template
 * @param options The email options
 * @returns Email response data
 */
export function sendEmail(to: string, subject: string, content?: string, path?: string, options?: emailOptions): Promise<emailData>;

/**
 * Send an email to all site administrators
 * @param emailType The type of email being sent out
 * @param subject The email subject
 * @param content The email content
 * @param filePath The file path to a HTML email template
 * @param options The email options
 * @returns Whether the function was successful
 */
export function sendEmailToAdmins(emailType: emailPreferenceTypes, subject: string, content?: string, filePath?: string, options?: emailOptions): Promise<boolean>;


export namespace API {
  type Methods = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE";
  type AuthenticationTypes = "Bearer";

  interface RequestReturnsAdvancedData {
    user?: UserSchema;
    bool: Boolean;
  }
  interface APIRequestOptions {
    authCookie?: Boolean;
    authHeader?: Boolean;
    allowedAuthTypes: AuthenticationTypes[];
    allowedMethods?: Methods[];
    allowVersions?: [];
    versionEnabled?: Boolean;
  }
  interface AuthObj {
    token: String;
    type: String;
  }

  /**
   * Check if a user is allowed to access an endpoint & the server is ready
   * @param req The incoming HTTP request
   * @param res The HTTP response
   * @param options The endpoints options
   * @param returnAdvancedData Return database queries
   */
  export function checkRequest(req: Request, res: Response, options: APIRequestOptions, returnAdvancedData: true): Promise<RequestReturnsAdvancedData>;
  export function checkRequest(req: Request, res: Response, options: APIRequestOptions, returnAdvancedData: false): Promise<Boolean>;
  export function checkRequest(req: Request, res: Response, options: APIRequestOptions, returnAdvancedData: boolean): Promise<Boolean>;

  /**
   * Get the authorization headers
   * @param {Object} headers The HTTP headers
   * @returns The authorization token & type
   */
  export function getAuth(headers: Headers): AuthObj;
}

export namespace users {
  interface findUserOpts {
    ignoreInvalidVariables: boolean;
    returnAdvancedErrors: boolean;
  }
  interface createUserOpts {
    resetPassword: boolean;
  }

  /**
   * Find all users
   * @returns The user accounts
   */
  export function getUsers(): Promise<Array<UserSchema_IncludePreferences>>;
  /**
   * Find all user email addresses based on email preferences
   * @param emailType The email preference type
   * @param includeNames Return an array of objects including user emails and names
   * @returns The user email addresses
   */
  export function getUserEmails(emailType: emailPreferenceTypes, includeNames: boolean): Promise<Array<String>>;
  /**
   * Find a user based on the authentication token
   * @param oauth The oauth token
   * @param options The function's options
   */
  export function findByOauth(oauth: string, options: findUserOpts): Promise<UserSchema> | null;
  /**
   * Find a user based on login information
   * @param username The user's username or email address
   * @param password The user's plaintext password
   * @param options The function's options
   */
  export function findByLogin(username: string, password: string, options: findUserOpts): Promise<UserSchema> | null;
  /**
   * Find a user based on ID
   * @param userId The user's ID
   * @param options The function's options
   */
  export function findById(userId: string, options: findUserOpts): Promise<UserSchema> | null;
  /**
   * Create a new user
   * @param fName The user's first name
   * @param sName The user's second name
   * @param username The user's username
   * @param email The user's email address
   * @param password The user's plaintext password
   * @param permissions The users' permissions
   * @param additionalOpts Additional user metadata
   */
  export function create(fName: string, sName: string, username: string, email: string, password: string, permissions: bigint, additionalOpts: createUserOpts): Promise<boolean>;

  /**
   * Check a plaintext password with a hashed password
   * @param hashedPassword The users hashed password
   * @param password The users plaintext password to compare
   * @returns Whether the passwords match
   */
  export function validatePassword(hashedPassword: string, password: string): boolean;

  /**
   * Create an authentication token
   * @param userId The user's ID
   * @param type The authentication token type
   * @returns The token
   */
  export function createAuthenticationToken(userId: string, type: number): Promise<string>;
}