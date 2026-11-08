export class RuleViolation extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RuleViolation";
  }
}

export function violate(code: string, message: string): never {
  throw new RuleViolation(code, message);
}
