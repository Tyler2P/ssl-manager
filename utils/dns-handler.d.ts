import { DnsProfilesSchema } from "./schemas";

/**
 * Update DNS records for a domain
 * @param dnsProfile The DNS Profile to update
 * @param record The name of the DNS record
 * @param value The value of the DNS record
 * @param primaryDomainName The primary domain name for the SSL certificate
 * @returns Whether the function was successful
 */
export function updateDNS(dnsProfile: DnsProfilesSchema | string, record: string, value: string, primaryDomainName?: string): Promise<boolean>;