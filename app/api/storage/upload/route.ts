import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // Create the Supabase client
    const supabase = await createClient();
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId = null;
    
    // Check session to ensure user is authenticated
    console.log('Checking session for file upload...');
    
    try {
      // Try cookie-based auth first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (session && session.user) {
        console.log('User authenticated via cookie for upload:', session.user.id);
        userId = session.user.id;
      } else if (sessionError) {
        console.error('Session error:', sessionError);
      }
    } catch (cookieError) {
      console.error('Cookie auth error:', cookieError);
    }
    
    // If cookie auth failed, try token-based auth
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      console.log('Trying token-based authentication for upload...');
      const token = authHeader.replace('Bearer ', '');
      
      try {
        const { data, error } = await supabase.auth.getUser(token);
        
        if (error) {
          console.error('Token authentication error:', error);
        } else if (data.user) {
          userId = data.user.id;
          console.log('User authenticated via token for upload:', userId);
        }
      } catch (tokenError) {
        console.error('Token processing error:', tokenError);
      }
    }
    
    // If authentication failed via normal means, try with admin client as a fallback
    if (!userId) {
      try {
        console.log('Using admin client as fallback for authentication...');
        // Parse cookies from request
        const cookies = request.headers.get('cookie');
        
        if (cookies) {
          // Create admin client
          const adminClient = createAdminClient();
          
          // Try to extract user ID from session token in cookies
          // This is more manual but can work as a fallback
          const authCookie = cookies.split(';')
            .find(c => c.trim().startsWith('sb-rtbqpprntygrgxopxoei-auth-token='));
            
          if (authCookie) {
            console.log('Found auth cookie, attempting to parse...');
            
            try {
              // Get the token from the auth cookie content
              const authSession = JSON.parse(decodeURIComponent(authCookie.split('=')[1]));
              const token = authSession[0]; // Token should be first element in array
              
              if (token) {
                const { data } = await adminClient.auth.getUser(token);
                if (data.user) {
                  userId = data.user.id;
                  console.log('Successfully authenticated user with admin client:', userId);
                }
              }
            } catch (parseError) {
              console.error('Error parsing auth cookie:', parseError);
            }
          }
        }
      } catch (adminError) {
        console.error('Admin authentication fallback error:', adminError);
      }
    }
    
    // If still no authentication, try to get user ID from form data directly
    // as a last resort (only useful if your form includes the user ID)
    if (!userId) {
      const formData = await request.formData();
      const userIdFromForm = formData.get('userId');
      
      if (userIdFromForm) {
        userId = userIdFromForm.toString();
        console.log('Using user ID from form data:', userId);
      }
    }
    
    // Check if we have a userId
    if (!userId) {
      console.log('Authentication failed, no user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log('File received for upload:', file.name, file.type, file.size);
    
    // Generate a unique filename with original extension
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // Use admin client for storage operations to bypass RLS
    const adminSupabase = createAdminClient();
    
    // First check if the bucket exists, create it if not
    try {
      const { data: buckets } = await adminSupabase.storage.listBuckets();
      const bucketName = 'package_images';
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log(`Creating storage bucket: ${bucketName}`);
        
        // Create the bucket with public access
        await adminSupabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg']
        });
        
        console.log(`Bucket ${bucketName} created successfully`);
      }
    } catch (bucketError) {
      console.error('Error checking/creating bucket:', bucketError);
    }
    
    // Upload to Supabase Storage
    console.log(`Uploading file to ${userId}/${fileName}`);
    
    const { data, error } = await adminSupabase.storage
      .from('package_images')
      .upload(`${userId}/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading file:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Get public URL for the file
    const { data: { publicUrl } } = adminSupabase.storage
      .from('package_images')
      .getPublicUrl(`${userId}/${fileName}`);
    
    console.log('File uploaded successfully, public URL:', publicUrl);
    
    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      key: `${userId}/${fileName}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
}
