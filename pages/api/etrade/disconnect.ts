import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { deleteUserTokens } from "@/lib/etrade/tokens";
import { invalidateUserServices } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  await deleteUserTokens(user.id);
  invalidateUserServices(user.id);

  return res.status(200).json({ ok: true });
}, "api/etrade/disconnect");