import { NextRequest, NextResponse } from 'next/server';
import * as adminModule from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  console.log("Magic link request API called");
  
  try {
    // Parse the request body
    const body = await request.json();
    const { userId, redirect } = body;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    console.log("DEBUG: Magic link requested for user ID:", userId);
    
    // Create admin client to fetch user data
    const adminClient = adminModule.createClient();
    
    // Get user details using admin client
    const { data: userData, error: userError } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
      
    if (userError || !userData) {
      console.error("Error retrieving user profile:", userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    console.log("DEBUG: User profile found for magic link:", userData.email);
    
    // Create a magic link for the user
    const { data: authData, error: authError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.email,
      options: {
        redirectTo: redirect || '/wallet',
      }
    });
    
    if (authError) {
      console.error("Error generating magic link:", authError);
      return NextResponse.json({ error: 'Could not generate magic link' }, { status: 500 });
    }
    
    // Don't send the email automatically, Supabase handles that
    console.log("DEBUG: Magic link generated successfully");
    
    return NextResponse.json({ 
      success: true, 
      message: 'Magic link email sent'
    });
  } catch (error) {
    console.error("Magic link request error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
