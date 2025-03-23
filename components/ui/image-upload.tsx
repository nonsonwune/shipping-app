"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Card, 
  CardContent 
} from '@/components/ui/card'
import { Camera, X, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/use-toast'

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void
  label?: string
  userId?: string
}

export function ImageUpload({ onImageUploaded, label = "Upload Package Image", userId }: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Get the auth token when component mounts
  useEffect(() => {
    const getAuthToken = async () => {
      try {
        // Use the new browser client from our unified architecture
        const supabase = createBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          setAuthToken(session.access_token)
        }
      } catch (err) {
        console.error('Error getting auth token:', err)
      }
    }
    getAuthToken()
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setError(null)
    setIsUploading(true)

    // Create preview
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Prepare form data for upload
    const formData = new FormData()
    formData.append('file', file)
    
    // Add user ID to form data as a fallback authentication method
    if (userId) {
      formData.append('userId', userId)
    }

    try {
      // Prepare headers with authentication if available
      const headers: HeadersInit = {}
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      // Upload to the backend
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include', // Include cookies for authentication
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      onImageUploaded(data.imageUrl)
      toast({
        title: "Image uploaded successfully",
        description: "Your package image has been uploaded.",
        variant: "default",
      })
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload image')
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : 'Failed to upload image',
        variant: "destructive",
      })
      // Keep preview despite error
    } finally {
      setIsUploading(false)
    }
  }

  const removeImage = () => {
    setPreviewUrl(null)
    onImageUploaded('')
    setError(null)
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {!previewUrl ? (
        <Card className="border-dashed">
          <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
            <Label 
              htmlFor="image-upload" 
              className="w-full h-32 flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-gray-700"
            >
              <Camera className="w-8 h-8 mb-2" />
              <span>Click to upload package photo</span>
              <span className="text-xs text-gray-400">PNG, JPG or JPEG (max 5MB)</span>
            </Label>
            <Input 
              id="image-upload" 
              type="file" 
              className="hidden" 
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/jpg"
              disabled={isUploading}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="relative w-full h-48 mb-4">
          <Image 
            src={previewUrl} 
            alt="Package preview" 
            fill 
            className="object-cover rounded-md" 
          />
          <Button 
            size="icon" 
            variant="destructive" 
            className="absolute top-2 right-2 rounded-full w-8 h-8 p-0"
            onClick={removeImage}
            disabled={isUploading}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {isUploading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <span className="text-sm">Uploading...</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
