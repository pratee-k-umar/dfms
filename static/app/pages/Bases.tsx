// import MapLayer from "@/components/Map";
// import MapLayer from "@/components/Map";
import baseService, { CreateBaseData } from "@/services/baseService";
import type { DroneBase } from "@/types/base";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
    useMapEvents,
} from "react-leaflet";

// Map Click Handler Component
function MapClickHandler({
    onMapClick,
}: {
    onMapClick: (lat: number, lng: number) => void;
}) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

// Map Center Controller Component
function MapCenterController({ center }: { center: [number, number] | null }) {
    const map = useMap();

    useEffect(() => {
        if (center) {
            map.flyTo(center, 13, { animate: true });
        }
    }, [center, map]);

    return null;
}

export default function Bases() {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedBase, setSelectedBase] = useState<DroneBase | null>(null);
    const [editingStatusBaseId, setEditingStatusBaseId] = useState<
        string | null
    >(null);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [newBaseLocation, setNewBaseLocation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [formData, setFormData] = useState<CreateBaseData>({
        name: "",
        location: { lat: 0, lng: 0 },
        address: "",
        region: "",
        max_drones: 50,
    });

    // Fetch bases
    const { data: basesData, isLoading } = useQuery({
        queryKey: ["bases"],
        queryFn: () => baseService.getAll(),
    });

    // Fetch base stats
    const { data: stats } = useQuery({
        queryKey: ["baseStats"],
        queryFn: baseService.getStats,
    });

    // Fetch drones for selected base
    const { data: baseDrones } = useQuery({
        queryKey: ["baseDrones", selectedBase?.base_id],
        queryFn: () =>
            selectedBase ? baseService.getDrones(selectedBase.base_id) : null,
        enabled: !!selectedBase,
    });

    // Create base mutation
    const createMutation = useMutation({
        mutationFn: baseService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bases"] });
            queryClient.invalidateQueries({ queryKey: ["baseStats"] });
            setShowCreateModal(false);
            setNewBaseLocation(null);
            setFormData({
                name: "",
                location: { lat: 0, lng: 0 },
                address: "",
                region: "",
                max_drones: 50,
            });
        },
    });

    // Delete base mutation
    const deleteMutation = useMutation({
        mutationFn: baseService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bases"] });
            queryClient.invalidateQueries({ queryKey: ["baseStats"] });
            setSelectedBase(null);
        },
    });

    // Update status mutation
    const updateStatusMutation = useMutation({
        mutationFn: ({ baseId, status }: { baseId: string; status: string }) =>
            baseService.update(baseId, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bases"] });
            queryClient.invalidateQueries({ queryKey: ["baseStats"] });
            setEditingStatusBaseId(null);
        },
    });

    const handleMapClick = (lat: number, lng: number) => {
        if (showCreateModal) {
            setNewBaseLocation({ lat, lng });
            setFormData((prev) => ({ ...prev, location: { lat, lng } }));
        }
    };

    const handleCreateBase = () => {
        if (!newBaseLocation) {
            alert("Please click on the map to select a location");
            return;
        }
        // Check for duplicate base name
        const isDuplicate = bases.some(
            (base) => base.name.toLowerCase() === formData.name.toLowerCase(),
        );
        if (isDuplicate) {
            alert(
                "A base with this name already exists. Please choose a different name.",
            );
            return;
        }
        createMutation.mutate(formData);
    };

    const handleDeleteBase = (baseId: string) => {
        if (confirm("Are you sure you want to delete this base?")) {
            deleteMutation.mutate(baseId);
        }
    };

    const bases = basesData?.data || [];

    // Filter bases based on selected status
    const filteredBases =
        statusFilter === "all"
            ? bases
            : bases.filter((base) => base.status === statusFilter);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">
                        Loading bases...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen">
            {/* Left Sidebar - Base List */}
            <div className="w-96 border-r bg-background flex flex-col">
                <div className="p-6 border-b flex-shrink-0">
                    <h1 className="text-2xl font-bold text-foreground">
                        Drone Bases
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage drone bases worldwide
                    </p>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="p-4 bg-muted/30 flex-shrink-0">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-card p-3 rounded-lg border">
                                <p className="text-xs text-muted-foreground">
                                    Total Bases
                                </p>
                                <p className="text-xl font-bold">
                                    {stats.total_bases}
                                </p>
                            </div>
                            <div className="bg-card p-3 rounded-lg border">
                                <p className="text-xs text-muted-foreground">
                                    Active
                                </p>
                                <p className="text-xl font-bold text-foreground">
                                    {stats.active_bases}
                                </p>
                            </div>
                            <div className="bg-card p-3 rounded-lg border">
                                <p className="text-xs text-muted-foreground">
                                    Capacity
                                </p>
                                <p className="text-xl font-bold">
                                    {stats.total_capacity}
                                </p>
                            </div>
                            <div className="bg-card p-3 rounded-lg border">
                                <p className="text-xs text-muted-foreground">
                                    Utilization
                                </p>
                                <p className="text-xl font-bold">
                                    {(stats.utilization ?? 0).toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Base Button */}
                <div className="p-4 border-b flex-shrink-0">
                    <button
                        onClick={() => setShowCreateModal(!showCreateModal)}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                            showCreateModal
                                ? "bg-muted text-foreground"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                    >
                        {showCreateModal ? "Cancel" : "+ Create New Base"}
                    </button>
                </div>

                {/* Create Base Form */}
                {showCreateModal && (
                    <div className="p-4 border-b bg-muted/20 flex-shrink-0">
                        <h3 className="font-semibold mb-3">New Base</h3>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Base Name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        name: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 border rounded-lg bg-background"
                            />
                            <input
                                type="number"
                                placeholder="Max Drones"
                                value={formData.max_drones}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        max_drones: parseInt(e.target.value),
                                    })
                                }
                                min={1}
                                max={100}
                                className="w-full px-3 py-2 border rounded-lg bg-background"
                            />
                            {newBaseLocation && (
                                <p className="text-xs text-muted-foreground">
                                    Location: {newBaseLocation.lat.toFixed(4)},{" "}
                                    {newBaseLocation.lng.toFixed(4)}
                                </p>
                            )}
                            <button
                                onClick={handleCreateBase}
                                disabled={
                                    !formData.name ||
                                    !newBaseLocation ||
                                    createMutation.isPending
                                }
                                className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createMutation.isPending
                                    ? "Creating..."
                                    : "Create Base"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Status Filter */}
                <div className="p-4 border-b bg-muted/10 flex-shrink-0">
                    <div className="flex gap-2">
                        {["all", "active", "maintenance", "offline"].map(
                            (filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setStatusFilter(filter)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        statusFilter === filter
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                    }`}
                                >
                                    {filter.charAt(0).toUpperCase() +
                                        filter.slice(1)}
                                </button>
                            ),
                        )}
                    </div>
                </div>

                {/* Base List */}
                <div className="divide-y overflow-y-auto flex-1">
                    {filteredBases.map((base) => (
                        <div
                            key={base.base_id}
                            onClick={() => setSelectedBase(base)}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-none focus:ring-0 active:outline-none ${
                                selectedBase?.base_id === base.base_id
                                    ? "bg-muted"
                                    : ""
                            }`}
                            tabIndex={0}
                            style={{ outline: "none" }}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-foreground">
                                        {base.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {base.address || "No address"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {base.region || "No region"}
                                    </p>
                                </div>
                                <div className="text-right relative">
                                    {editingStatusBaseId === base.base_id ? (
                                        <select
                                            value={base.status}
                                            onChange={(e) => {
                                                updateStatusMutation.mutate({
                                                    baseId: base.base_id,
                                                    status: e.target.value,
                                                });
                                            }}
                                            onBlur={() =>
                                                setEditingStatusBaseId(null)
                                            }
                                            autoFocus
                                            className="px-2 py-1 text-xs border rounded bg-background cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="active">
                                                active
                                            </option>
                                            <option value="maintenance">
                                                maintenance
                                            </option>
                                            <option value="offline">
                                                offline
                                            </option>
                                        </select>
                                    ) : (
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingStatusBaseId(
                                                    base.base_id,
                                                );
                                            }}
                                            className={`inline-block px-2 py-1 text-xs rounded-full cursor-pointer hover:opacity-80 transition-opacity ${
                                                base.status === "active"
                                                    ? "bg-primary/10 text-primary"
                                                    : base.status ===
                                                        "maintenance"
                                                      ? "bg-muted text-muted-foreground"
                                                      : "bg-muted text-muted-foreground"
                                            }`}
                                        >
                                            {base.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    Drones:
                                </span>
                                <span className="font-medium">
                                    {base.drone_count} / {base.max_drones}
                                </span>
                            </div>
                            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary"
                                    style={{
                                        width: `${(base.drone_count / base.max_drones) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Side - Map */}
            <div className="flex-1 p-6 bg-muted/20">
                <div className="h-full bg-card border rounded-lg overflow-hidden shadow-lg">
                    <MapContainer
                        center={[20, 0]}
                        zoom={2}
                        style={{ height: "100%", width: "100%" }}
                        className="z-0"
                    >
                        <TileLayer
                            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png?app=MyReactAppName&contact=prateek0426@gmail.com"
                            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
                            keepBuffer={2}
                            updateWhenIdle={true}
                        />
                        <MapClickHandler onMapClick={handleMapClick} />
                        <MapCenterController
                            center={
                                selectedBase
                                    ? [selectedBase.lat, selectedBase.lng]
                                    : null
                            }
                        />

                        {/* Base Markers */}
                        {bases.map((base) => (
                            <Marker
                                key={base.base_id}
                                position={[base.lat, base.lng]}
                                eventHandlers={{
                                    click: () => setSelectedBase(base),
                                }}
                            >
                                <Popup>
                                    <div className="p-2">
                                        <h3 className="font-semibold">
                                            {base.name}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {base.address}
                                        </p>
                                        <p className="text-sm mt-2">
                                            <strong>Drones:</strong>{" "}
                                            {base.drone_count}/{base.max_drones}
                                        </p>
                                        <p className="text-sm">
                                            <strong>Status:</strong>{" "}
                                            {base.status}
                                        </p>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {/* New Base Marker (temporary) */}
                        {newBaseLocation && showCreateModal && (
                            <Marker
                                position={[
                                    newBaseLocation.lat,
                                    newBaseLocation.lng,
                                ]}
                            >
                                <Popup>
                                    <div className="p-2">
                                        <p className="font-semibold">
                                            New Base Location
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {newBaseLocation.lat.toFixed(4)},{" "}
                                            {newBaseLocation.lng.toFixed(4)}
                                        </p>
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                    </MapContainer>

                    {/* Selected Base Detail Panel */}
                    {selectedBase && !showCreateModal && (
                        <div className="absolute top-10 right-10 w-96 bg-card border rounded-lg shadow-lg p-6 z-[1000]">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold">
                                        {selectedBase.name}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedBase.base_id}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedBase(null)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Address
                                    </p>
                                    <p className="font-medium">
                                        {selectedBase.address || "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Region
                                    </p>
                                    <p className="font-medium">
                                        {selectedBase.region || "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Location
                                    </p>
                                    <p className="font-mono text-sm">
                                        {selectedBase.lat.toFixed(4)},{" "}
                                        {selectedBase.lng.toFixed(4)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Capacity
                                    </p>
                                    <p className="font-medium">
                                        {selectedBase.drone_count} /{" "}
                                        {selectedBase.max_drones} drones
                                    </p>
                                </div>

                                {/* Drones at this base */}
                                {baseDrones &&
                                    baseDrones.data &&
                                    baseDrones.data.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-sm font-semibold mb-2">
                                                Drones at Base
                                            </p>
                                            <div className="max-h-40 overflow-y-auto space-y-2">
                                                {baseDrones.data.map(
                                                    (drone: any) => (
                                                        <div
                                                            key={drone.drone_id}
                                                            className="text-sm p-2 bg-muted rounded"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-medium">
                                                                    {drone.name}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {
                                                                        drone.status
                                                                    }
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                Battery:{" "}
                                                                {
                                                                    drone.battery_level
                                                                }
                                                                %
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    )}

                                <button
                                    onClick={() =>
                                        handleDeleteBase(selectedBase.base_id)
                                    }
                                    className="w-full mt-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    disabled={deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending
                                        ? "Deleting..."
                                        : "Delete Base"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    {showCreateModal && (
                        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg z-[1000]">
                            Click on the map to select a location for the new
                            base
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
