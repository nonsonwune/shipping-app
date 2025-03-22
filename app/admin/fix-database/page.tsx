'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Check, X } from 'lucide-react';

// Admin emails for authentication
const ADMIN_EMAILS = [
  'admin@yourcompany.com', 
  '7umunri@gmail.com',
  'chuqunonso@gmail.com'
];

export default function FixDatabasePage() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [sqlOutput, setSqlOutput] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const [succeeded, setSucceeded] = useState<boolean | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        // Check if user is admin
        const isAdmin = ADMIN_EMAILS.includes(session.user.email?.toLowerCase() || '');
        setAuthorized(isAdmin);
      }
      
      setLoading(false);
    };

    checkUser();
  }, []);

  const executeSQL = async () => {
    setExecuting(true);
    setSqlOutput([]);
    setSucceeded(null);
    
    try {
      // Step 1: Add username column if it doesn't exist
      setSqlOutput(prev => [...prev, "Checking and adding username column if needed..."]);
      
      const { error: columnError } = await supabase.rpc('execute_sql', {
        query: `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'profiles'
              AND column_name = 'username'
            ) THEN
              ALTER TABLE public.profiles ADD COLUMN username TEXT;
              RAISE NOTICE 'Username column added successfully';
            ELSE
              RAISE NOTICE 'Username column already exists';
            END IF;
          END
          $$;
        `
      }).single();
      
      if (columnError) {
        // If RPC method doesn't exist, try a different approach
        if (columnError.message.includes('execute_sql')) {
          setSqlOutput(prev => [...prev, "The execute_sql RPC function doesn't exist. Using direct SQL API..."]);
          
          // Try to add the column directly through the REST API
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ username: 'tempValue' })
            .eq('id', 'tempId');
            
          if (updateError && updateError.message.includes('column "username" does not exist')) {
            setSqlOutput(prev => [...prev, "Column doesn't exist. Please go to the Supabase SQL Editor and run:"]);
            setSqlOutput(prev => [...prev, "ALTER TABLE public.profiles ADD COLUMN username TEXT;"]);
            setSqlOutput(prev => [...prev, "Then return to this page and try again."]);
            setSucceeded(false);
            setExecuting(false);
            return;
          }
        } else {
          throw columnError;
        }
      }
      
      setSqlOutput(prev => [...prev, "Column check completed or column added."]);
      
      // Step 2: Update existing profiles to have username = email where it's null
      setSqlOutput(prev => [...prev, "Updating existing profiles to have username equal to email..."]);
      
      // Get all profiles
      const { data: profiles, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email');
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (!profiles || profiles.length === 0) {
        setSqlOutput(prev => [...prev, "No profiles found to update."]);
      } else {
        setSqlOutput(prev => [...prev, `Found ${profiles.length} profiles to update...`]);
        
        // Update each profile
        let successCount = 0;
        let errorCount = 0;
        
        for (const profile of profiles) {
          try {
            if (!profile.email) continue;
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ username: profile.email })
              .eq('id', profile.id);
            
            if (updateError) {
              setSqlOutput(prev => [...prev, `Error updating profile ${profile.id}: ${updateError.message}`]);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err: any) {
            setSqlOutput(prev => [...prev, `Error updating profile ${profile.id}: ${err.message}`]);
            errorCount++;
          }
        }
        
        setSqlOutput(prev => [...prev, `Updated ${successCount} profiles successfully. ${errorCount} errors.`]);
      }
      
      setSqlOutput(prev => [...prev, "Database fix operation completed!"]);
      setSucceeded(true);
    } catch (error: any) {
      setSqlOutput(prev => [...prev, `Unexpected error: ${error.message}`]);
      setSucceeded(false);
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Checking authorization...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-12">
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-yellow-800">
            You need to be logged in to access this page. Please <a href="/admin/login" className="font-medium underline">sign in</a>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="container mx-auto py-12">
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">
            You do not have permission to access this page. This incident will be reported.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Database Fix Utility</h1>
      
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Fix Username Column</h2>
        <p className="text-gray-600 mb-6">
          This utility will add the username column to the profiles table if it doesn't exist,
          and update all existing profiles to have username equal to email where it's null.
        </p>
        
        <Button 
          onClick={executeSQL}
          disabled={executing}
          className="mb-6"
        >
          {executing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Database Fix...
            </>
          ) : (
            'Run Database Fix'
          )}
        </Button>
        
        {succeeded !== null && (
          <Alert className={`mb-6 ${succeeded ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center">
              {succeeded ? (
                <Check className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <X className="h-5 w-5 text-red-500 mr-2" />
              )}
              <AlertDescription className={succeeded ? 'text-green-800' : 'text-red-800'}>
                {succeeded ? 'Database fix completed successfully!' : 'There were problems with the database fix.'}
              </AlertDescription>
            </div>
          </Alert>
        )}
        
        {sqlOutput.length > 0 && (
          <div className="bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm overflow-y-auto max-h-96">
            {sqlOutput.map((line, i) => (
              <div key={i} className="py-1">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => window.location.href = '/admin/dashboard'}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
