"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Home, Building2, Briefcase, Edit, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function SavedAddressesPage() {
  const [addresses, setAddresses] = useState([
    {
      id: 1,
      name: "Home",
      icon: Home,
      address: "123 Admiralty Way",
      city: "Lekki",
      state: "Lagos",
      country: "Nigeria",
      isDefault: true,
    },
    {
      id: 2,
      name: "Office",
      icon: Briefcase,
      address: "45 Broad Street",
      city: "Lagos Island",
      state: "Lagos",
      country: "Nigeria",
      isDefault: false,
    },
    {
      id: 3,
      name: "Warehouse",
      icon: Building2,
      address: "78 Warehouse Road",
      city: "Apapa",
      state: "Lagos",
      country: "Nigeria",
      isDefault: false,
    },
  ])

  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [editingAddress, setEditingAddress] = useState<null | number>(null)

  const handleDeleteAddress = (id: number) => {
    setAddresses(addresses.filter((address) => address.id !== id))
  }

  const handleSetDefault = (id: number) => {
    setAddresses(
      addresses.map((address) => ({
        ...address,
        isDefault: address.id === id,
      })),
    )
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/account" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Saved Addresses</h1>
      </div>

      <div className="mb-6">
        <Button className="w-full flex items-center gap-2" onClick={() => setIsAddingAddress(true)}>
          <Plus className="w-4 h-4" />
          Add New Address
        </Button>
      </div>

      <div className="space-y-4">
        {addresses.map((address) => (
          <div key={address.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start">
              <div className="bg-blue-100 p-2 rounded-full mr-3">
                {address.icon && <address.icon className="w-5 h-5 text-primary" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <h3 className="font-bold">{address.name}</h3>
                  {address.isDefault && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Default</span>
                  )}
                </div>

                <p className="text-sm text-gray-600">{address.address}</p>
                <p className="text-sm text-gray-600">
                  {address.city}, {address.state}
                </p>
                <p className="text-sm text-gray-600">{address.country}</p>

                <div className="flex mt-3 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setEditingAddress(address.id)}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>

                  {!address.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleSetDefault(address.id)}
                    >
                      Set as Default
                    </Button>
                  )}

                  {!address.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => handleDeleteAddress(address.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isAddingAddress} onOpenChange={setIsAddingAddress}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
            <DialogDescription>Enter the details of your new address.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Address Name</Label>
              <Input id="name" placeholder="e.g. Home, Office, etc." />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Street Address</Label>
              <Input id="address" placeholder="Enter street address" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="Enter city" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" placeholder="Enter state" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Select defaultValue="nigeria">
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nigeria">Nigeria</SelectItem>
                  <SelectItem value="ghana">Ghana</SelectItem>
                  <SelectItem value="kenya">Kenya</SelectItem>
                  <SelectItem value="south-africa">South Africa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input type="checkbox" id="default" className="rounded border-gray-300" />
              <Label htmlFor="default">Set as default address</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingAddress(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsAddingAddress(false)}>Save Address</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingAddress !== null} onOpenChange={() => setEditingAddress(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
            <DialogDescription>Update your address details.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Address Name</Label>
              <Input id="edit-name" defaultValue={addresses.find((a) => a.id === editingAddress)?.name || ""} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-address">Street Address</Label>
              <Input id="edit-address" defaultValue={addresses.find((a) => a.id === editingAddress)?.address || ""} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-city">City</Label>
                <Input id="edit-city" defaultValue={addresses.find((a) => a.id === editingAddress)?.city || ""} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-state">State</Label>
                <Input id="edit-state" defaultValue={addresses.find((a) => a.id === editingAddress)?.state || ""} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-country">Country</Label>
              <Select defaultValue={addresses.find((a) => a.id === editingAddress)?.country.toLowerCase() || "nigeria"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nigeria">Nigeria</SelectItem>
                  <SelectItem value="ghana">Ghana</SelectItem>
                  <SelectItem value="kenya">Kenya</SelectItem>
                  <SelectItem value="south-africa">South Africa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-default"
                className="rounded border-gray-300"
                defaultChecked={addresses.find((a) => a.id === editingAddress)?.isDefault || false}
              />
              <Label htmlFor="edit-default">Set as default address</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAddress(null)}>
              Cancel
            </Button>
            <Button onClick={() => setEditingAddress(null)}>Update Address</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

