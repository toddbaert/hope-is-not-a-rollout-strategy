// a minimal input guardrail in the style of guardrail frameworks: a list of scanners, each returning a "verdict"
type Verdict = { valid: boolean; reason?: string };
type Scanner = (input: string) => Verdict;

const arithmeticOnly: Scanner = (input) =>
  /^[\d\s.+\-*/]+$/.test(input) ? { valid: true } : { valid: false, reason: 'input is not a pure arithmetic expression' };

const scanners: Scanner[] = [arithmeticOnly];

// first "failing" verdict, if any
export const scan = (input: string): Verdict =>
  scanners.map((scanner) => scanner(input)).find((verdict) => !verdict.valid) ?? { valid: true };
