/**
 * Who may judge what.
 *
 * A banner is made by four agents and judged in three places, and the people
 * who can usefully judge each place are not the same people. An art director
 * looking at a headline has an opinion; it is not the opinion this system
 * should learn from, because that feedback goes straight into the
 * copywriter's instructions. Letting everyone judge everything does not
 * gather more evidence, it gathers noisier evidence — and the whole
 * improvement loop downstream treats every verdict as equally informed.
 *
 * So each specialist judges their own craft, and the two roles whose job IS
 * the whole banner judge all of it.
 */

export const ROLES = ['admin', 'marketing', 'copywriter', 'strategist', 'art-director'] as const;
export type Role = (typeof ROLES)[number];

/** The three things a person can judge, named the same way everywhere. */
export type VerdictStage = 'choice' | 'copy' | 'layout';

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

export interface RoleMeta {
  id: Role;
  label: string;
  /** What this person does, in their own terms. */
  does: string;
  /** Which verdicts they may leave. */
  judges: VerdictStage[];
  /** Why those and not the others. */
  because: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  admin: {
    id: 'admin',
    label: 'Admin',
    does: 'runs the factory: rules, prompts, experiments and who is who',
    judges: ['choice', 'copy', 'layout'],
    because: 'answerable for the whole thing, so nothing is out of reach',
  },
  marketing: {
    id: 'marketing',
    label: 'Marketing',
    does: 'owns the campaign the banners belong to',
    judges: ['choice', 'copy', 'layout'],
    because: 'the banner is the unit they are judged on, not any one part of it',
  },
  copywriter: {
    id: 'copywriter',
    label: 'Copywriter',
    does: 'writes for this brand and knows its voice',
    judges: ['copy'],
    because: 'a verdict on the words is what the copywriter agent learns from',
  },
  strategist: {
    id: 'strategist',
    label: 'Strategist',
    does: 'decides what the shop should be pushing and on what terms',
    judges: ['choice', 'copy'],
    because:
      'which product goes in front of a customer is their call, and so is which facts earn a place beside the price — the strategist agent writes those badges alongside the copy',
  },
  'art-director': {
    id: 'art-director',
    label: 'Art director',
    does: 'is responsible for how the banner looks',
    judges: ['layout'],
    because: 'a verdict on the layout is what the art director agent learns from',
  },
};

export const ALL_ROLES: RoleMeta[] = ROLES.map((r) => ROLE_META[r]);

export function canJudge(role: Role | null, stage: VerdictStage): boolean {
  if (!role) return false;
  return ROLE_META[role].judges.includes(stage);
}

/**
 * The two roles that can hand out roles.
 *
 * Marketing is in here with admin because somebody has to be able to add
 * their own team without going through the person who runs the servers, and
 * that is the shape every real team ends up with anyway.
 */
export function canAssignRoles(role: Role | null): boolean {
  return role === 'admin' || role === 'marketing';
}

/** One line for a screen that has to explain a greyed-out button. */
export function whyNot(role: Role | null, stage: VerdictStage): string {
  if (!role) return 'Sign in and ask for a role to judge this.';
  const meta = ROLE_META[role];
  const mine = meta.judges.map(labelOf).join(' and ');
  return `${meta.label}s judge ${mine}. This one belongs to someone else.`;
}

export function labelOf(stage: VerdictStage): string {
  return stage === 'choice' ? 'the product' : stage === 'copy' ? 'the words' : 'the layout';
}
