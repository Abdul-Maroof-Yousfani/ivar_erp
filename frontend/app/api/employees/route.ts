import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    // This is a placeholder route - actual employee data is fetched via server actions
    return NextResponse.json({ message: 'Use server actions to fetch employees' }, { status: 200 });
}
