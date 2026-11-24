/**
 * The tunable prompts, and what each agent is for.
 *
 * Only three are here, and the absence of the fourth is deliberate. The
 * matcher and the business policy decide WHICH product goes on the banner,
 * and the "choice" verdicts are feedback about them — but replaying that
 * decision means running the whole recommend workflow per eval case, which
 * costs more than every other part of this loop put together, and the rules
 * that drive it are already editable as sentences on the Rules screen. The
 * cheap, replayable stages come first; the choice stage is the next piece of
 * work, not an oversight.
 *
 * This module imports the agents, so nothing an agent imports may import
 * this. The store takes a baseline as an argument for exactly that reason.
 */
import { COPYWRITER_INSTRUCTIONS } from '../mastra/agents/copywriter.js';
import { STRATEGIST_INSTRUCTIONS } from '../mastra/agents/strategist.js';
import { ART_DIRECTOR_INSTRUCTIONS } from '../mastra/agents/art-director.js';
import { PROMPT_IDS, type PromptId } from './index.js';

export interface PromptMeta {
  id: PromptId;
  label: string;
  /** One line for the improver and for the screen. */
  role: string;
  /** The instructions under source control. */
  baseline: string;
}

export const PROMPT_META: Record<PromptId, PromptMeta> = {
  copywriter: {
    id: 'copywriter',
    label: 'Copywriter',
    role: 'writes the headline, the phrase set in green inside it, the supporting line and picks the button from a closed list',
    baseline: COPYWRITER_INSTRUCTIONS,
  },
  strategist: {
    id: 'strategist',
    label: 'Strategist',
    role: 'decides which of the permitted facts — saving, energy label, member price, warranty — earn a place on the banner, and in what order',
    baseline: STRATEGIST_INSTRUCTIONS,
  },
  'art-director': {
    id: 'art-director',
    label: 'Art director',
    role: 'breaks the headline into lines and sets how large the product is drawn',
    baseline: ART_DIRECTOR_INSTRUCTIONS,
  },
};

export const ALL_PROMPTS: PromptMeta[] = PROMPT_IDS.map((id) => PROMPT_META[id]);
