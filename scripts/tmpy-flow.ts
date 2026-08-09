import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildGameFlowSteps } from "@/lib/foundation/game-flow-steps";
const gs: any = createPersistenceService().getActiveSave()!.gameState;
const steps: any = buildGameFlowSteps({ gameState: gs } as any);
const liste = Array.isArray(steps) ? steps : (steps?.steps ?? []);
console.log("Schritte:", liste.length);
for (const s of liste) console.log(`  ${String(s.stepId).padEnd(30)} ${s.status}`);
