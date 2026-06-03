import { type APIComponentV2, type APIMessageComponentsV2Payload } from './types';
export interface ValidationIssue {
    /** Dot/bracket path to the offending node, e.g. `components[0].accessory`. */
    path: string;
    message: string;
}
export interface ValidationResult {
    ok: boolean;
    errors: ValidationIssue[];
    /** Non-fatal advisories (e.g. fields Discord ignores in messages). */
    warnings: ValidationIssue[];
}
/** Validate a single component subtree (any depth). */
export declare function validateComponent(component: APIComponentV2, path?: string): ValidationResult;
/** Recursively count every component node (nested components included). */
export declare function countComponents(components: APIComponentV2[]): number;
/** Sum characters across every Text Display in the tree. */
export declare function countTextChars(components: APIComponentV2[]): number;
/**
 * Validate a complete Components V2 message payload: the IsComponentsV2 flag,
 * forbidden coexisting fields, the 40-component cap, the 4000-char cap, and the
 * full component tree.
 */
export declare function validateMessage(payload: APIMessageComponentsV2Payload): ValidationResult;
//# sourceMappingURL=validators.d.ts.map