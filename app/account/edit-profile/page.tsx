"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Camera, Mail, Phone, User, AtSign } from "lucide-react"
import { useRouter } from "next/navigation"
import { createBrowserClient, safeQuerySingle } from "@/lib/supabase"
import type { Database } from "@/types/supabase"

type UserProfile = Database['public']['Tables']['profiles']['Row']

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [profile, setProfile] = useState<Partial<UserProfile> & { profilePicture?: string }>({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
    profilePicture: "/placeholder.svg?height=100&width=100",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function getProfile() {
      setLoading(true)
      setError(null)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) throw sessionError
        if (!session) {
          router.push("/auth/sign-in")
          return
        }

        setUserId(session.user.id)

        const { data, error: profileError } = await safeQuerySingle(
          supabase,
          "profiles",
          "first_name, last_name, username, email, phone",
          { id: session.user.id }
        )

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            console.error("Edit Profile page: Possible RLS issue preventing SELECT or table/column doesn't exist?")
          }
          throw profileError
        }

        if (isMounted && data) {
          setProfile(prev => ({
            ...prev,
            first_name: data.first_name ?? "",
            last_name: data.last_name ?? "",
            username: data.username ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
          }))
        }
      } catch (err: any) {
        console.error("Edit Profile page: Error loading profile CATCH block:", err)
        if (isMounted) setError(err.message || "Failed to load profile.")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    getProfile()
    
    return () => { isMounted = false }

  }, [router, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) {
      setError("User not identified. Cannot save.")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const updates: Partial<UserProfile> = {
      first_name: profile.first_name || null,
      last_name: profile.last_name || null,
      username: profile.username || null,
      email: profile.email || null,
      phone: profile.phone || null,
    }

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select()

      if (updateError) {
        if (updateError.code === '42501') {
          console.error("Edit Profile page: UPDATE RLS permission denied? Code: 42501")
        }
        throw updateError
      }

      setSuccess("Profile updated successfully!")

    } catch (err: any) {
      console.error("Edit Profile page: Error updating profile CATCH block:", err)
      setError(err.message || "Failed to save profile.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error && !saving) {
      return <div className="p-4 text-red-600 text-center">{error}</div>;
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/account" className="mr-4">
          <ArrowLeft className="w-6 h-6 text-black dark:text-white" />
        </Link>
        <h1 className="text-2xl font-bold text-black dark:text-white">Edit Profile</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-slate-700 shadow-md">
              <Image
                src={profile.profilePicture || "/placeholder.svg"}
                alt="Profile"
                width={100}
                height={100}
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-md"
              title="Change profile picture (feature coming soon)"
              disabled
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tap to change profile picture (coming soon)</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-black dark:text-white">Personal Information</h2>
          </div>

          <div className="p-4 space-y-4">
            {error && saving && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <div className="space-y-2">
              <Label htmlFor="first_name" className="flex items-center gap-2 text-black dark:text-white">
                <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                First Name
              </Label>
              <Input
                id="first_name"
                name="first_name"
                value={profile.first_name || ''}
                onChange={handleChange}
                placeholder="Enter your first name"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name" className="flex items-center gap-2 text-black dark:text-white">
                <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Last Name
              </Label>
              <Input
                id="last_name"
                name="last_name"
                value={profile.last_name || ''}
                onChange={handleChange}
                placeholder="Enter your last name"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2 text-black dark:text-white">
                <AtSign className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Username
              </Label>
              <Input
                id="username"
                name="username"
                value={profile.username || ''}
                onChange={handleChange}
                placeholder="Enter your username"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-black dark:text-white">
                <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Email Address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={profile.email || ''}
                onChange={handleChange}
                placeholder="Enter your email address"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2 text-black dark:text-white">
                <Phone className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Phone Number
              </Label>
              <Input
                id="phone"
                name="phone"
                value={profile.phone || ''}
                onChange={handleChange}
                placeholder="Enter your phone number"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-black dark:text-white">Account Verification</h2>
          </div>

          <div className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Verify your identity to unlock additional features and increase your shipping limits.
            </p>

            <Button variant="outline" className="w-full text-black dark:text-white border-slate-200 dark:border-slate-700">
              Verify Identity
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/account" className="w-1/2">
            <Button variant="outline" className="w-full text-black dark:text-white border-slate-200 dark:border-slate-700">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="w-1/2 bg-blue-600 text-white" disabled={saving || loading}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
