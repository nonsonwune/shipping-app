import { NextRequest, NextResponse } from 'next/server';
import { setupStorage } from '@/utils/supabase/storage-setup';

// Initialize app services when the first request comes in
let initialized = false;

export async function GET(request: NextRequest) {
  if (!initialized) {
    try {
      // Set up storage buckets
      await setupStorage();
      
      initialized = true;
      console.log('App services initialized successfully');
    } catch (error) {
      console.error('Error initializing app services:', error);
    }
  }
  
  return NextResponse.json({ initialized });
}
