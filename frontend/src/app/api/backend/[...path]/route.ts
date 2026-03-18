import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.CAPITALBASE_API_BASE_URL ?? "http://127.0.0.1:8000";
const API_TOKEN = process.env.CAPITALBASE_API_TOKEN;
const API_TENANT_ID = process.env.CAPITALBASE_API_TENANT_ID;

function buildTargetUrl(pathSegments: string[], search: string): string {
  const normalizedBase = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = pathSegments.map(encodeURIComponent).join("/");
  return `${normalizedBase}/${normalizedPath}${search}`;
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const targetUrl = buildTargetUrl(path, request.nextUrl.search);

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (API_TOKEN) {
    headers.set("authorization", `Bearer ${API_TOKEN}`);
  }
  if (API_TENANT_ID) {
    headers.set("x-tenant-id", API_TENANT_ID);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) {
      responseHeaders.set("content-type", upstreamType);
    }

    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown backend proxy error";
    return NextResponse.json(
      { detail: `Backend proxy request failed: ${detail}` },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  return proxyRequest(request, context);
}
