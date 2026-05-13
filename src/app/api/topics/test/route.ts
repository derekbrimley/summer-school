import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // Just count topics
    const { count, error } = await supabase
      .from("topics")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({
        error: "Query failed",
        details: error.message,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json({
      status: "ok",
      topic_count: count,
      message: `Found ${count ?? 0} topics in database`
    });
  } catch (err) {
    return NextResponse.json({
      error: "Caught exception",
      message: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
