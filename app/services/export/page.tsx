import ServiceCard from "@/components/service-card"

export default function ExportServicesPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-center py-4">Our Services</h1>

      <div className="mt-6">
        <ServiceCard
          title="Export by Sea"
          description="Send heavy and oversized items via sea freight, delivered in 8-12 weeks."
          imagePath="/images/export-sea.png"
          slug="export-sea"
        />

        <ServiceCard
          title="Export by Air"
          description="Quick and reliable air freight shipping options for businesses and individuals."
          imagePath="/images/export-sea.png"
          slug="export-air"
        />
      </div>
    </div>
  )
}

