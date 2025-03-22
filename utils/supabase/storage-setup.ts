import { createClient } from '@supabase/supabase-js';

// Create a storage bucket for package images if it doesn't exist
export async function setupStorage() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase URL or service role key not found');
      return;
    }
    
    // Create an admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
    
    if (bucketsError) {
      console.error('Error listing storage buckets:', bucketsError);
      return;
    }
    
    const bucketName = 'package_images';
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Creating storage bucket: ${bucketName}`);
      
      // Create the bucket
      const { error: createError } = await supabase
        .storage
        .createBucket(bucketName, {
          public: true,
          fileSizeLimit: 5242880, // 5MB limit
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg']
        });
      
      if (createError) {
        console.error('Error creating storage bucket:', createError);
        return;
      }
      
      console.log(`Storage bucket "${bucketName}" created successfully`);
    } else {
      console.log(`Storage bucket "${bucketName}" already exists`);
    }
    
  } catch (error) {
    console.error('Error setting up storage:', error);
  }
}
