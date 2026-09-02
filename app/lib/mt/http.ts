// ============================================================
// מיני־מכרז — תשתית HTTP משותפת ל-/api/mt/*
// שגיאות אחידות: { error: { code, message } } + קוד HTTP.
// אפיון טכני סעיף 7.
// ============================================================
import { NextResponse } from "next/server";

export class MtHttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const bad = (msg: string, code = "validation") => new MtHttpError(400, code, msg);
export const unauthorized = (msg = "נדרשת התחברות") => new MtHttpError(401, "unauthorized", msg);
export const forbidden = (msg = "אין הרשאה לפעולה זו") => new MtHttpError(403, "forbidden", msg);
export const notFound = (msg = "לא נמצא") => new MtHttpError(404, "not_found", msg);
export const conflict = (msg: string, code = "conflict") => new MtHttpError(409, code, msg);
export const tooMany = (msg = "יותר מדי בקשות — נסו שוב מאוחר יותר") => new MtHttpError(429, "rate_limited", msg);

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw bad("גוף הבקשה חייב להיות JSON");
    return body as T;
  } catch (e) {
    if (e instanceof MtHttpError) throw e;
    throw bad("גוף הבקשה אינו JSON תקין");
  }
}

// עוטף handler: כל MtHttpError הופך לתשובת JSON מסודרת; כל שגיאה אחרת — 500 בלי דליפת פרטים.
export function handle<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof MtHttpError) {
        return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      console.error("[mt] unhandled:", e);
      return NextResponse.json({ error: { code: "internal", message: "שגיאה פנימית" } }, { status: 500 });
    }
  };
}

export type Params<T> = { params: Promise<T> };
