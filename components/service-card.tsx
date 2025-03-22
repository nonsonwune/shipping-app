import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ServiceCardProps {
  title: string
  description: string
  imagePath: string
  slug: string
}

export default function ServiceCard({ title, description, imagePath, slug }: ServiceCardProps) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-6">
      <div className="p-0">
        <Image src={imagePath || "/placeholder.svg"} alt={title} width={600} height={400} className="w-full h-auto" />
      </div>
      <div className="p-6 bg-white rounded-b-xl">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="flex gap-3">
          <Link href={`/services/${slug}/features`} className="w-full">
            <Button variant="outline" className="w-full border-primary text-primary">
              View Features
            </Button>
          </Link>
          <Link href={`/services/${slug}/ship`} className="w-full">
            <Button className="w-full bg-primary text-white">Ship Now</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

