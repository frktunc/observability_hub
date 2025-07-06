"use strict";
/**
 * Base types for observability events
 * Generated from JSON Schema contracts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_VERSIONS = exports.EVENT_TYPE_PATTERNS = void 0;
exports.parseVersion = parseVersion;
exports.isVersionCompatible = isVersionCompatible;
/**
 * Event type patterns for validation
 */
exports.EVENT_TYPE_PATTERNS = {
    LOG: /^log\.(message|error|warning|info|debug)\.(created|updated)$/,
    METRICS: /^metrics\.(counter|gauge|histogram|summary)\.(created|updated)$/,
    TRACE: /^trace\.(span)\.(started|finished|created|updated)$/,
};
/**
 * Parse semantic version string into components
 */
function parseVersion(version) {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match || !match[1] || !match[2] || !match[3])
        return null;
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
    };
}
/**
 * Check if two versions are compatible (same major version)
 */
function isVersionCompatible(v1, v2) {
    const version1 = parseVersion(v1);
    const version2 = parseVersion(v2);
    if (!version1 || !version2)
        return false;
    return version1.major === version2.major;
}
/**
 * Current schema versions
 */
exports.SCHEMA_VERSIONS = {
    BASE_EVENT: '1.0.0',
    LOG_EVENT: '1.0.0',
    METRICS_EVENT: '1.0.0',
    TRACE_EVENT: '1.0.0',
};
//# sourceMappingURL=base.js.map