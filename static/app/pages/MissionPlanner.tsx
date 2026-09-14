import baseService from "@/services/baseService";
import { missionService } from "@/services/missionService";
import type { CreateMissionRequest } from "@/types/mission";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LatLng } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import {
    MapContainer,
    Marker,
    Polygon,
    Popup,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";
import { useNavigate } from "react-router-dom";
// import { area } from "@turf/area";

// Fix Leaflet icon issue
import L from "leaflet";
import { toast, Toaster } from "sonner";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom icon for bases
const baseIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function MapClickHandler({
    onMapClick,
}: {
    onMapClick: (latlng: LatLng) => void;
}) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng);
        },
    });
    return null;
}

function MapCenter({ newLocation }: { newLocation: NewLocation | null }) {
    const map = useMap();

    useEffect(() => {
        if (newLocation) map.flyTo([newLocation.lat, newLocation.lon], 13);
    }, [newLocation, map]);

    return null;
}

type PlaceSuggestions = {
    display_name: string;
    lat: number;
    lon: number;
};

type NewLocation = {
    lat: number;
    lon: number;
};

export default function MissionPlanner() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [polygonPoints, setPolygonPoints] = useState<LatLng[]>([]);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        site_name: "",
        survey_type: "mapping" as const,
        altitude: 50,
        speed: 10,
        overlap: 70,
    });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [suggestion, setSuggestion] = useState<PlaceSuggestions[]>([]);
    const [showDropDown, setShowDropDown] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] =
        useState<number>(-1);
    const [newLocation, setNewLocation] = useState<NewLocation | null>(null);
    const listRef = useRef<(HTMLLIElement | null)[]>([]);
    // const [polygonDist, setPolygonDist] = useState<number[]>([]);
    // const polygonArea = useState(null);

    // Fetch all bases
    const { data: basesData } = useQuery({
        queryKey: ["bases"],
        queryFn: () => baseService.getAll(),
    });

    const bases = basesData?.data || [];

    const createMissionMutation = useMutation({
        mutationFn: (data: CreateMissionRequest) => missionService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["missions"] });
            setPolygonPoints([]);
            setFormData({
                name: "",
                description: "",
                site_name: "",
                survey_type: "mapping",
                altitude: 50,
                speed: 10,
                overlap: 70,
            });
            // Redirect to missions page after successful creation
            navigate("/missions");
        },
    });

    const handleMapClick = (point: LatLng) => {
        const lastPoint = polygonPoints[polygonPoints.length - 1];
        
        if(lastPoint) {
            const distance = lastPoint.distanceTo(point);
            if (distance > 5000) {
                toast.error("Distance between the points exceeds 5000 meters. Please select a closer point.");
                return;
            }

            // setPolygonDist((prevDistances) => [...prevDistances, distance]);
        }
        
        const updatedPoints = [...polygonPoints, point];

        if(updatedPoints.length >= 5) {
            const avg_lat = updatedPoints.reduce((sum, currentPoint) => {
                return sum + currentPoint.lat;
            }, 0) / updatedPoints.length;

            const lat_to_meters = 111000;
            const lon_to_meters = 111000 * Math.cos((avg_lat * Math.PI) / 180);

            const coordinates_in_meters = updatedPoints.map((p) => ({
                x: p.lng * lon_to_meters,
                y: p.lat * lat_to_meters
            }));

            let polygonArea = 0;

            for(let i = 0; i < coordinates_in_meters.length; i++) {
                const next_idx = (i + 1) % coordinates_in_meters.length;

                polygonArea += coordinates_in_meters[i].x * coordinates_in_meters[next_idx].y;
                polygonArea -= coordinates_in_meters[next_idx].x * coordinates_in_meters[i].y;
            }

            polygonArea = Math.abs(polygonArea / 2);

            if(polygonArea > 100000) {
                toast.error("The area of the polygon exceeds 100,000 square meters. Please select points that form a smaller area.");
                return;
            }
        }

        setPolygonPoints(updatedPoints);
    };

    const handleClearLastPolygonPoint = () => {
        setPolygonPoints((previousPoints) => previousPoints.slice(0, -1));
    };

    const handleClearPolygon = () => {
        setPolygonPoints([]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.site_name) {
            alert("Please fill in mission name and site name");
            return;
        }

        if (polygonPoints.length < 3) {
            alert("Please draw a survey area (at least 3 points)");
            return;
        }

        const coverage_area = {
            type: "Polygon",
            coordinates: [
                [
                    ...polygonPoints.map((p) => [p.lng, p.lat]),
                    [polygonPoints[0].lng, polygonPoints[0].lat],
                ],
            ],
        };

        createMissionMutation.mutate({
            ...formData,
            coverage_area,
        });
    };

    useEffect(() => {
        if (!search.trim()) {
            setSuggestion([]);
            setShowDropDown(false);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        const { signal } = controller;

        const fetchData = async () => {
            setShowDropDown(true);
            setLoading(true);
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${search}&format=jsonv2`,
                    { signal },
                );
                const data: PlaceSuggestions[] = await response.json();
                setSuggestion(data);
            } catch (error) {
                if (error !== "AbortError")
                    console.error("Error fetching search results:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        return () => {
            controller.abort();
        };
    }, [search]);

    useEffect(() => {
        const selectedItem = listRef.current[selectedSuggestionIndex];

        selectedItem?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
        });
    }, [selectedSuggestionIndex]);

    const handleSuggestionClick = (item: PlaceSuggestions) => {
        setNewLocation({ lat: item.lat, lon: item.lon });
        setShowDropDown(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedSuggestionIndex((prevIndex) =>
                Math.min(prevIndex + 1, suggestion.length - 1),
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedSuggestionIndex((prevIndex) =>
                Math.max(prevIndex - 1, 0),
            );
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (suggestion[selectedSuggestionIndex]) {
                handleSuggestionClick(suggestion[selectedSuggestionIndex]);
                setSuggestion([]);
                setShowDropDown(false);
            }
        }
    };

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground">
                    Mission Planner
                </h1>
                <p className="mt-2 text-muted-foreground">
                    Plan and configure drone tasks
                </p>
            </div>
            <Toaster position="top-right" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b flex items-center justify-between">
                            <h2 className="text-[17px] font-semibold text-card-foreground">
                                Map out Survey Area (Select atleast 3 points in
                                the map)
                            </h2>
                            {polygonPoints.length > 0 ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleClearPolygon}
                                        className="text-[12px] text-muted-foreground hover:text-foreground px-3 py-1 rounded border"
                                    >
                                        Clear ({polygonPoints.length} points)
                                    </button>
                                    <button
                                        onClick={handleClearLastPolygonPoint}
                                        disabled={polygonPoints.length === 1}
                                        className="text-[12px] text-muted-foreground hover:text-foreground px-3 py-1 rounded border disabled:cursor-not-allowed"
                                    >
                                        Clear previous point
                                    </button>
                                </div>
                            ) : (
                                <div className="w-1/3 relative">
                                    <input
                                        name="Search Input"
                                        className="text-[12px] w-full px-3 py-1 bg-background border rounded-md text-foreground"
                                        type="text"
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                        onKeyDown={handleKeyDown}
                                        placeholder="Enter city, address, or country..."
                                    />
                                    {showDropDown &&
                                        (loading || suggestion.length > 0) && (
                                            <ul className="suggestion-dropdown w-full absolute bg-white rounded-md list-none p-0 m-0 max-h-[200px] overflow-y-auto z-[1000] shadow-[0_4px_6px_rgba(0,0,0,0.1)]">
                                                {loading ? (
                                                    <li className="px-2 py-1">
                                                        Loading...
                                                    </li>
                                                ) : (
                                                    suggestion.map(
                                                        (item, index) => (
                                                            <li
                                                                ref={(
                                                                    element,
                                                                ) => {
                                                                    listRef.current[
                                                                        index
                                                                    ] = element;
                                                                }}
                                                                key={`${item.lat}-${item.lon}`}
                                                                className={`suggestion-item cursor-pointer border-b px-2 py-1 hover:bg-gray-300 ${index === selectedSuggestionIndex && "bg-gray-300"}`}
                                                                onClick={() =>
                                                                    setSelectedSuggestionIndex(
                                                                        index,
                                                                    )
                                                                }
                                                                onMouseDown={() =>
                                                                    handleSuggestionClick(
                                                                        item,
                                                                    )
                                                                }
                                                            >
                                                                {
                                                                    item.display_name
                                                                }
                                                            </li>
                                                        ),
                                                    )
                                                )}
                                            </ul>
                                        )}
                                </div>
                            )}
                        </div>
                        <div className="h-[613px]">
                            <MapContainer
                                center={[20.5937, 78.9629]}
                                zoom={5}
                                style={{ height: "100%", width: "100%" }}
                            >
                                <TileLayer
                                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png?app=MyReactAppName&contact=prateek0426@gmail.com"
                                    attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
                                    keepBuffer={2}
                                    updateWhenIdle={true}
                                />
                                <MapClickHandler onMapClick={handleMapClick} />

                                <MapCenter newLocation={newLocation} />

                                {/* Base markers */}
                                {bases.map((base: any) => (
                                    <Marker
                                        key={base.base_id}
                                        position={[base.lat, base.lng]}
                                        icon={baseIcon}
                                    >
                                        <Popup autoClose={false}>
                                            <div className="p-2">
                                                <h3 className="font-semibold text-sm mb-1">
                                                    {base.name}
                                                </h3>
                                                <div className="text-xs space-y-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">
                                                            Status:
                                                        </span>
                                                        <span className="capitalize font-medium">
                                                            {base.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">
                                                            Capacity:
                                                        </span>
                                                        <span>
                                                            {base.capacity}{" "}
                                                            drones
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">
                                                            Drones:
                                                        </span>
                                                        <span>
                                                            {base.drone_count ||
                                                                0}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {base.lat.toFixed(4)},{" "}
                                                        {base.lng.toFixed(4)}
                                                    </div>
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}

                                {polygonPoints.map((point, idx) => (
                                    <Marker key={idx} position={point} />
                                ))}

                                {polygonPoints.length >= 3 && (
                                    <Polygon
                                        positions={polygonPoints}
                                        pathOptions={{
                                            color: "blue",
                                            fillOpacity: 0.2,
                                        }}
                                    />
                                )}
                            </MapContainer>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <form
                        onSubmit={handleSubmit}
                        className="bg-card rounded-lg border shadow-sm p-6"
                    >
                        <h2 className="text-lg font-semibold text-card-foreground mb-4">
                            Mission Configuration
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Mission Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value,
                                        })
                                    }
                                    className="w-full px-3 py-2 bg-background border rounded-md text-foreground"
                                    placeholder="e.g., Site Survey #1"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Site Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.site_name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            site_name: e.target.value,
                                        })
                                    }
                                    className="w-full px-3 py-2 bg-background border rounded-md text-foreground"
                                    placeholder="e.g., Construction Site A"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            description: e.target.value,
                                        })
                                    }
                                    className="w-full px-3 py-2 bg-background border rounded-md text-foreground"
                                    rows={3}
                                    placeholder="Optional mission details"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Survey Type
                                </label>
                                <select
                                    value={formData.survey_type}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            survey_type: e.target.value as any,
                                        })
                                    }
                                    className="w-full px-3 py-2 bg-background border rounded-md text-foreground"
                                >
                                    <option value="mapping">Mapping</option>
                                    <option value="inspection">
                                        Inspection
                                    </option>
                                    <option value="surveillance">
                                        Surveillance
                                    </option>
                                    <option value="delivery">Delivery</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Altitude (m)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.altitude}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                altitude: Number(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                        className="w-full px-3 py-2 bg-background border rounded-md text-foreground"
                                        min="10"
                                        max="120"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Speed (m/s)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.speed}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                speed: Number(e.target.value),
                                            })
                                        }
                                        className="w-full px-3 py-2 bg-background border rounded-md text-foreground"
                                        min="1"
                                        max="20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Overlap (%)
                                </label>
                                <input
                                    type="number"
                                    value={formData.overlap}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            overlap: Number(e.target.value),
                                        })
                                    }
                                    className="w-full px-3 py-2 bg-background border rounded-md text-foreground"
                                    min="0"
                                    max="90"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={
                                    createMissionMutation.isPending ||
                                    polygonPoints.length < 3
                                }
                                className="w-full py-2 px-4 bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {createMissionMutation.isPending
                                    ? "Creating..."
                                    : "Create Mission"}
                            </button>

                            {createMissionMutation.isSuccess && (
                                <p className="text-sm text-muted-foreground text-center">
                                    Mission created successfully!
                                </p>
                            )}

                            {createMissionMutation.isError && (
                                <p className="text-sm text-muted-foreground text-center">
                                    Error creating mission
                                </p>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
