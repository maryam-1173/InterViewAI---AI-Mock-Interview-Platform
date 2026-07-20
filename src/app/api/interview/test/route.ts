import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";

export async function GET() {
  try {
    const response = await ai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: "Reply with only: API Working",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: response.choices[0].message.content,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}