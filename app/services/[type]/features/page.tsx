import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Check } from "lucide-react"

interface ServiceFeaturesPageProps {
  params: {
    type: string
  }
}

export default async function ServiceFeaturesPage({ params }: ServiceFeaturesPageProps) {
  const type = params.type

  // Map service types to their display names and descriptions
  const serviceInfo: Record<string, { title: string; description: string; image: string; features: string[] }> = {
    "import-sea": {
      title: "Import by Sea",
      description: "Ship heavy and oversized items via sea freight and receive your items in 8-12 weeks.",
      image: "/images/sea-import.png",
      features: [
        "Cost-effective for heavy items",
        "Ideal for non-urgent shipments",
        "Full container or shared container options",
        "Door-to-door delivery available",
        "Real-time tracking",
        "Insurance options available",
        "Customs clearance assistance",
      ],
    },
    "china-imports": {
      title: "China Imports",
      description: "Import from China's retailers and manufacturers. Delivered affordably to Nigeria.",
      image: "/images/budget-imports.png",
      features: [
        "Direct sourcing from Chinese suppliers",
        "Product verification before shipping",
        "Consolidation of multiple orders",
        "Customs clearance included",
        "Competitive shipping rates",
        "English-speaking support",
        "Payment protection",
      ],
    },
    "export-sea": {
      title: "Export by Sea",
      description: "Send heavy and oversized items via sea freight, delivered in 8-12 weeks.",
      image: "/images/export-sea.png",
      features: [
        "Affordable rates for large shipments",
        "Suitable for commercial exports",
        "Documentation assistance",
        "Customs compliance support",
        "Container loading supervision",
        "Insurance options",
        "Global destination coverage",
      ],
    },
    "export-air": {
      title: "Export by Air",
      description: "Quick and reliable air freight shipping options for businesses and individuals.",
      image: "/images/export-sea.png",
      features: [
        "Fast delivery times (3-7 days)",
        "Ideal for time-sensitive shipments",
        "Worldwide destination coverage",
        "Simplified documentation process",
        "Higher security and less handling",
        "Regular flight schedules",
        "Suitable for high-value items",
      ],
    },
  }

  const service = serviceInfo[type] || {
    title: "Service Features",
    description: "Learn more about our shipping services.",
    image: "/placeholder.svg",
    features: ["Feature information not available"],
  }

  return (
    <div className="pb-20">
      <div className="bg-primary text-white p-4">
        <div className="flex items-center mb-4">
          <Link href="/services" className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">Service Features</h1>
        </div>

        <h2 className="text-2xl font-bold mb-2">{service.title}</h2>
        <p className="text-sm opacity-90 mb-4">{service.description}</p>
      </div>

      <div className="p-4">
        <Image
          src={service.image || "/placeholder.svg"}
          alt={service.title}
          width={600}
          height={400}
          className="w-full h-auto rounded-xl mb-6"
        />

        <h3 className="text-xl font-bold mb-4">Features & Benefits</h3>

        <div className="space-y-3 mb-6">
          {service.features.map((feature, index) => (
            <div key={index} className="flex items-start">
              <div className="bg-green-100 rounded-full p-1 mr-3 mt-0.5">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <p>{feature}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-6">
          <h3 className="font-medium mb-2">Need more information?</h3>
          <p className="text-sm text-gray-600 mb-3">
            Our shipping experts are available to answer any questions you may have.
          </p>
          <Button className="w-full bg-primary text-white">Contact Support</Button>
        </div>

        <Link href={`/services/${type}/ship`}>
          <Button className="w-full bg-primary text-white">Ship Now</Button>
        </Link>
      </div>
    </div>
  )
}
