import { NextResponse } from 'next/server';
import { activeRules, isStale, loadPolicy, savePolicy, type Policy } from '@/src/policy/index.js';
import {
  POLICY_MODEL, compilePrompt, policyCompileSchema, policyCompiler,
} from '@/src/mastra/agents/policy.js';
import { hasApiKey } from '@/src/mastra/agents/category-validator.js';
import { readUsage } from '@/src/cost/index.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = (policy: Policy) => ({ policy, stale: isStale(policy) });

export async function GET() {
  return NextResponse.json(body(loadPolicy()));
}

/** Saving bumps the version, which is what makes the cached policy stale. */
export async function PUT(request: Request) {
  const input = (await request.json().catch(() => null)) as { policy?: Policy } | null;
  if (!input?.policy) return NextResponse.json({ error: 'expected { policy }' }, { status: 400 });
  return NextResponse.json(body(savePolicy(input.policy)));
}

/**
 * Compiling: the one model call the rules screen makes.
 *
 * It runs when a person asks for it, not when a banner is made, because the
 * policy only changes when the rules change. The result is stored against the
 * version it came from, so a later edit marks it stale rather than silently
 * leaving a run on the old rules.
 */
export async function POST() {
  const policy = loadPolicy();
  const rules = activeRules(policy);

  if (!rules.length) {
    return NextResponse.json({ error: 'There are no rules to compile.' }, { status: 400 });
  }
  if (!hasApiKey()) {
    return NextResponse.json({ error: 'No GOOGLE_GENERATIVE_AI_API_KEY in the environment.' }, { status: 400 });
  }

  try {
    const result = await policyCompiler.generate(compilePrompt(rules), {
      structuredOutput: { schema: policyCompileSchema },
    });
    const out = result.object;
    if (!out?.policy) {
      return NextResponse.json({ error: 'The compiler returned no policy.' }, { status: 502 });
    }

    const usage = await readUsage(result);
    const saved = savePolicy({
      ...policy,
      // savePolicy bumps the version, so the compilation is stamped with the
      // version it will BE once saved, not the one it was read at.
      compiled: {
        policy: out.policy,
        conflicts: out.conflicts ?? [],
        unusable: out.unusable ?? [],
        fromVersion: policy.version + 1,
        at: new Date().toISOString(),
        model: POLICY_MODEL,
      },
    });

    return NextResponse.json({
      ...body(saved),
      usage: { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }
}
