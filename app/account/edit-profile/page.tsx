"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Camera, Mail, Phone, User } from "lucide-react"

export default function EditProfilePage() {
  const [profile, setProfile] = useState({
    name: "Chukwunonso Nwune",
    email: "chuqunonso@gmail.com",
    phone: "+234 812 345 6789",
    profilePicture: "/placeholder.svg?height=100&width=100",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Save profile changes
    console.log("Profile updated:", profile)
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
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tap to change profile picture</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-black dark:text-white">Personal Information</h2>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2 text-black dark:text-white">
                <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Full Name
              </Label>
              <Input
                id="name"
                name="name"
                value={profile.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
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
                value={profile.email}
                onChange={handleChange}
                placeholder="Enter your email address"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
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
                value={profile.phone}
                onChange={handleChange}
                placeholder="Enter your phone number"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
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
          <Button type="submit" className="w-1/2 bg-blue-600 text-white">
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
