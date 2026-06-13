import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
          const body = await req.json();

          const { businessName, ownerName, email, phone, category, region, employees, notification } = body;

          // Validate required fields
          if (!businessName || !email || !phone || !category || !region) {
                  return NextResponse.json(
                            { error: 'שדות חובה חסרים' },
                            { status: 400 }
                          );
                }

          // Basic email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
                  return NextResponse.json(
                            { error: 'אימייל לא תקין' },
                            { status: 400 }
                          );
                }

          // TODO: Save to database (Supabase / Prisma)
          // For now, log the registration
          console.log('נרשם עסק חדש:', {
                  businessName,
                  ownerName,
                  email,
                  phone,
                  category,
                  region,
                  employees,
                  notification,
                  registeredAt: new Date().toISOString(),
                });

          // TODO: Send welcome message via WhatsApp (Twilio)
          // TODO: Send welcome email (SendGrid)

          return NextResponse.json(
                  {
                            success: true,
                            message: `שלום ${ownerName || businessName}! הרשמת בוצעה בהצלחה.`,
                            data: { businessName, email, category, region, notification },
                          },
                  { status: 201 }
                );
        } catch (error) {
          console.error('שגיאה בהרשמה:', error);
          return NextResponse.json(
                  { error: 'שגיאת שרת פנימי' },
                  { status: 500 }
                );
        }
  }
