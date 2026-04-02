import { GoogleMap, useJsApiLoader, Marker, Circle } from "@react-google-maps/api";
import { useCallback, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Branch = Tables<"branches">;

interface BranchMapProps {
  branches: Branch[];
  onMapClick: (lat: number, lng: number) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const defaultCenter = { lat: 3.1390, lng: 101.6869 }; // KL, Malaysia

const mapContainerStyle = { width: "100%", height: "100%" };

const BranchMap = ({ branches, onMapClick }: BranchMapProps) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const handleClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      onMapClick(e.latLng.lat(), e.latLng.lng());
    }
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex items-center justify-center h-full bg-muted text-muted-foreground text-sm">
        <div className="text-center p-4">
          <p className="font-medium">Google Maps API Key Required</p>
          <p className="mt-1">
            Set <code className="bg-accent px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> in your environment to enable the map.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={branches.length > 0 ? { lat: branches[0].latitude, lng: branches[0].longitude } : defaultCenter}
      zoom={12}
      onLoad={onLoad}
      onClick={handleClick}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
      }}
    >
      {branches.map((branch) => (
        <div key={branch.id}>
          <Marker
            position={{ lat: branch.latitude, lng: branch.longitude }}
            title={branch.name}
          />
          <Circle
            center={{ lat: branch.latitude, lng: branch.longitude }}
            radius={branch.radius_meters}
            options={{
              fillColor: "hsl(222.2, 47.4%, 11.2%)",
              fillOpacity: 0.15,
              strokeColor: "hsl(222.2, 47.4%, 11.2%)",
              strokeOpacity: 0.4,
              strokeWeight: 2,
            }}
          />
        </div>
      ))}
    </GoogleMap>
  );
};

export default BranchMap;
