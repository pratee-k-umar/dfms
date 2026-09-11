import { droneService } from "@/services/droneService";
import { missionService } from "@/services/missionService";
import { normalizeLongitude } from "@/utils/geo";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState } from "react";
import {
    MapContainer,
    Marker,
    Polygon,
    Polyline,
    Popup,
    TileLayer,
} from "react-leaflet";

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function Analytics() {
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
        null,
    );
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const ITEMS_PER_PAGE = 10;

    const { data: missionsData, isLoading: missionsLoading } = useQuery({
        queryKey: ["missions", "analytics"],
        queryFn: () => missionService.getAll({ limit: 100 }), // Fetch more for pagination
    });

    const { data: missionStats, isLoading: statsLoading } = useQuery({
        queryKey: ["missionStats"],
        queryFn: missionService.getStats,
    });

    const { data: fleetStats, isLoading: fleetLoading } = useQuery({
        queryKey: ["fleetStats"],
        queryFn: droneService.getStats,
    });

    // Show loading state until all main data is loaded
    const isLoading = missionsLoading || statsLoading || fleetLoading;

    const missions = missionsData?.data || [];

    // Fetch selected mission details
    const { data: selectedMissionData } = useQuery({
        queryKey: ["mission", selectedMissionId],
        queryFn: () =>
            selectedMissionId
                ? missionService.getById(selectedMissionId)
                : null,
        enabled: !!selectedMissionId,
    });

    // Fetch telemetry for selected mission
    const { data: telemetryData } = useQuery({
        queryKey: ["telemetry", selectedMissionId, "all"],
        queryFn: () =>
            selectedMissionId
                ? missionService.getAllTelemetry(selectedMissionId)
                : null,
        enabled: !!selectedMissionId,
    });

    const selectedMission = selectedMissionData;
    const telemetryPoints = telemetryData?.data || [];

    // Use stats from API (includes data from ALL missions, not just limited list)
    const totalFlightTime = missionStats?.total_flight_time || 0;
    const avgFlightTime = missionStats?.avg_flight_time || 0;
    const totalAreaCovered = missionStats?.total_area_covered || 0;
    const totalImages = missionStats?.total_images_captured || 0;

    const overviewStats = [
        { label: "Total Missions", value: missionStats?.total || 0 },
        { label: "Completed", value: missionStats?.completed || 0 },
        { label: "In Progress", value: missionStats?.in_progress || 0 },
        {
            label: "Failed/Aborted",
            value: (missionStats?.failed || 0) + (missionStats?.aborted || 0),
        },
    ];

    const fleetOverview = [
        { label: "Total Drones", value: fleetStats?.data?.total || 0 },
        { label: "Available", value: fleetStats?.data?.available || 0 },
        { label: "In Mission", value: fleetStats?.data?.in_mission || 0 },
        { label: "Maintenance", value: fleetStats?.data?.maintenance || 0 },
    ];

    const performanceStats = [
        {
            label: "Total Flight Time",
            value: `${Math.round(totalFlightTime)} min`,
            subtext: `${Math.round(totalFlightTime / 60)} hours`,
        },
        {
            label: "Avg Flight Time",
            value: `${Math.round(avgFlightTime)} min`,
            subtext: "Per mission",
        },
        {
            label: "Total Area Covered",
            value:
                totalAreaCovered > 0
                    ? `${Math.round(totalAreaCovered).toLocaleString()} m²`
                    : "0 m²",
            subtext:
                totalAreaCovered > 0
                    ? `${(totalAreaCovered / 10000).toFixed(2)} hectares`
                    : "0 hectares",
        },
        {
            label: "Images Captured",
            value: totalImages.toLocaleString(),
            subtext: "Across all missions",
        },
    ];

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">
                        Analytics & Reports
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Survey statistics and performance metrics
                    </p>
                </div>
                <div className="space-y-6">
                    {/* Loading skeleton cards */}
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="bg-card rounded-lg border shadow-sm p-6 animate-pulse"
                        >
                            <div className="h-6 bg-muted rounded w-48 mb-4"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((j) => (
                                    <div
                                        key={j}
                                        className="bg-background rounded-lg border p-4"
                                    >
                                        <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                                        <div className="h-8 bg-muted rounded w-16"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground">
                    Analytics & Reports
                </h1>
                <p className="mt-2 text-muted-foreground">
                    Survey statistics and performance metrics
                </p>
            </div>

            <div className="space-y-6">
                {/* Mission Overview */}
                <div className="bg-card rounded-lg border shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-card-foreground mb-4">
                        Mission Overview
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {overviewStats.map((stat) => (
                            <div
                                key={stat.label}
                                className="bg-background rounded-lg border p-4"
                            >
                                <p className="text-sm text-muted-foreground">
                                    {stat.label}
                                </p>
                                <p className="text-3xl font-bold mt-2 text-foreground">
                                    {stat.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Fleet Overview */}
                <div className="bg-card rounded-lg border shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-card-foreground mb-4">
                        Fleet Status
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {fleetOverview.map((stat) => (
                            <div
                                key={stat.label}
                                className="bg-background rounded-lg border p-4"
                            >
                                <p className="text-sm text-muted-foreground">
                                    {stat.label}
                                </p>
                                <p className="text-3xl font-bold mt-2 text-foreground">
                                    {stat.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-card rounded-lg border shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-card-foreground mb-4">
                        Performance Metrics
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {performanceStats.map((stat) => (
                            <div
                                key={stat.label}
                                className="bg-background rounded-lg border p-4"
                            >
                                <p className="text-sm text-muted-foreground">
                                    {stat.label}
                                </p>
                                <p className="text-2xl font-bold mt-2 text-foreground">
                                    {stat.value}
                                </p>
                                {stat.subtext && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {stat.subtext}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Missions */}
                <div className="bg-card rounded-lg border shadow-sm">
                    <div className="px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap">
                        <h2 className="text-xl font-semibold text-card-foreground">
                            All Missions
                        </h2>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search missions..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1); // Reset to first page on search
                                }}
                                className="pl-10 pr-4 py-2 border rounded-md bg-background text-foreground text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                    </div>
                    <div className="p-6">
                        {missions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                No missions yet. Create your first mission in
                                the Mission Planner.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                {(() => {
                                    // Filter missions by search query
                                    const filteredMissions = missions.filter(
                                        (mission: any) =>
                                            mission.name
                                                .toLowerCase()
                                                .includes(
                                                    searchQuery.toLowerCase(),
                                                ) ||
                                            mission.site_name
                                                ?.toLowerCase()
                                                .includes(
                                                    searchQuery.toLowerCase(),
                                                ) ||
                                            mission.status
                                                .toLowerCase()
                                                .includes(
                                                    searchQuery.toLowerCase(),
                                                ),
                                    );

                                    // Pagination
                                    const totalPages = Math.ceil(
                                        filteredMissions.length /
                                            ITEMS_PER_PAGE,
                                    );
                                    const startIndex =
                                        (currentPage - 1) * ITEMS_PER_PAGE;
                                    const paginatedMissions =
                                        filteredMissions.slice(
                                            startIndex,
                                            startIndex + ITEMS_PER_PAGE,
                                        );

                                    return (
                                        <>
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b">
                                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                                            Mission
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                                            Site
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                                            Type
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                                            Status
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                                            Progress
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                                            Created
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedMissions.map(
                                                        (mission: any) => (
                                                            <tr
                                                                key={
                                                                    mission.mission_id
                                                                }
                                                                className="border-b hover:bg-muted/50 transition-colors"
                                                            >
                                                                <td className="py-3 px-4 text-sm font-medium text-foreground">
                                                                    {
                                                                        mission.name
                                                                    }
                                                                </td>
                                                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                                                    {
                                                                        mission.site_name
                                                                    }
                                                                </td>
                                                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                                                    {
                                                                        mission.survey_type
                                                                    }
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                                                                        {
                                                                            mission.status
                                                                        }
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                                                    {Math.round(
                                                                        mission.progress,
                                                                    )}
                                                                    %
                                                                </td>
                                                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                                                    {new Date(
                                                                        mission.created_at,
                                                                    ).toLocaleDateString()}
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <button
                                                                        onClick={() =>
                                                                            setSelectedMissionId(
                                                                                mission.mission_id,
                                                                            )
                                                                        }
                                                                        className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                                                                    >
                                                                        View
                                                                        Details
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>

                                            {/* Pagination Controls */}
                                            {totalPages > 1 && (
                                                <div className="flex items-center justify-between px-4 py-3 border-t">
                                                    <p className="text-sm text-muted-foreground">
                                                        Showing {startIndex + 1}
                                                        -
                                                        {Math.min(
                                                            startIndex +
                                                                ITEMS_PER_PAGE,
                                                            filteredMissions.length,
                                                        )}{" "}
                                                        of{" "}
                                                        {
                                                            filteredMissions.length
                                                        }{" "}
                                                        missions
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() =>
                                                                setCurrentPage(
                                                                    (p) =>
                                                                        Math.max(
                                                                            1,
                                                                            p -
                                                                                1,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                currentPage ===
                                                                1
                                                            }
                                                            className="p-2 rounded border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                className="h-4 w-4"
                                                                fill="none"
                                                                viewBox="0 0 24 24"
                                                                stroke="currentColor"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d="M15 19l-7-7 7-7"
                                                                />
                                                            </svg>
                                                        </button>
                                                        <span className="text-sm font-medium px-3">
                                                            Page {currentPage}{" "}
                                                            of {totalPages}
                                                        </span>
                                                        <button
                                                            onClick={() =>
                                                                setCurrentPage(
                                                                    (p) =>
                                                                        Math.min(
                                                                            totalPages,
                                                                            p +
                                                                                1,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                currentPage ===
                                                                totalPages
                                                            }
                                                            className="p-2 rounded border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                className="h-4 w-4"
                                                                fill="none"
                                                                viewBox="0 0 24 24"
                                                                stroke="currentColor"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d="M9 5l7 7-7 7"
                                                                />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {filteredMissions.length === 0 &&
                                                searchQuery && (
                                                    <p className="text-center text-muted-foreground py-8">
                                                        No missions found
                                                        matching "{searchQuery}"
                                                    </p>
                                                )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mission Details Modal */}
            {selectedMissionId && selectedMission && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedMissionId(null)}
                >
                    <div
                        className="bg-card rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-card-foreground">
                                {selectedMission.name}
                            </h2>
                            <button
                                onClick={() => setSelectedMissionId(null)}
                                className="text-muted-foreground hover:text-foreground text-2xl font-bold"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Mission Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Mission ID
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        {selectedMission.mission_id}
                                    </p>
                                </div>
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Status
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                                            {selectedMission.status}
                                        </span>
                                    </p>
                                </div>
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Progress
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        {Math.round(selectedMission.progress)}%
                                    </p>
                                </div>
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Site Name
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        {selectedMission.site_name}
                                    </p>
                                </div>
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Survey Type
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        {selectedMission.survey_type}
                                    </p>
                                </div>
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Altitude
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        {selectedMission.altitude}m
                                    </p>
                                </div>
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Speed
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        {selectedMission.speed}m/s
                                    </p>
                                </div>
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Area Covered
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        {Math.round(
                                            selectedMission.area_covered || 0,
                                        ).toLocaleString()}{" "}
                                        m<sup>2</sup>
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {(
                                            (selectedMission.area_covered ||
                                                0) / 10000
                                        ).toFixed(2)}{" "}
                                        hectares
                                    </p>
                                </div>
                                <div className="bg-background rounded-lg border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Created
                                    </p>
                                    <p className="text-lg font-semibold text-foreground mt-1">
                                        {new Date(
                                            selectedMission.created_at,
                                        ).toLocaleString()}
                                    </p>
                                </div>
                                {selectedMission.started_at && (
                                    <div className="bg-background rounded-lg border p-4">
                                        <p className="text-sm text-muted-foreground">
                                            Started
                                        </p>
                                        <p className="text-lg font-semibold text-foreground mt-1">
                                            {new Date(
                                                selectedMission.started_at,
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                )}
                                {selectedMission.completed_at && (
                                    <div className="bg-background rounded-lg border p-4">
                                        <p className="text-sm text-muted-foreground">
                                            Completed
                                        </p>
                                        <p className="text-lg font-semibold text-foreground mt-1">
                                            {new Date(
                                                selectedMission.completed_at,
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                )}
                                {selectedMission.assigned_drone_id && (
                                    <div className="bg-background rounded-lg border p-4">
                                        <p className="text-sm text-muted-foreground">
                                            Drone
                                        </p>
                                        <p className="text-lg font-semibold text-foreground mt-1">
                                            {selectedMission.assigned_drone_id}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Flight Path Map */}
                            <div className="bg-background rounded-lg border overflow-hidden">
                                <div className="px-4 py-3 border-b">
                                    <h3 className="text-lg font-semibold text-foreground">
                                        Flight Path
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {telemetryPoints.length > 0
                                            ? `Showing ${telemetryPoints.length} telemetry points`
                                            : "No telemetry data available"}
                                    </p>
                                </div>
                                <div className="h-[500px]">
                                    {(() => {
                                        // Get coverage area polygon - normalize coordinates
                                        let coveragePolygon: [
                                            number,
                                            number,
                                        ][] = [];
                                        if (
                                            selectedMission.coverage_area
                                                ?.coordinates?.[0]
                                        ) {
                                            coveragePolygon =
                                                selectedMission.coverage_area.coordinates[0].map(
                                                    (coord: number[]) =>
                                                        [
                                                            coord[1],
                                                            normalizeLongitude(
                                                                coord[0],
                                                            ),
                                                        ] as [number, number],
                                                );
                                        }

                                        // Get actual flight path from telemetry - normalize coordinates
                                        const flightPath: [number, number][] =
                                            telemetryPoints.map(
                                                (point: any) =>
                                                    [
                                                        point.position.lat,
                                                        normalizeLongitude(
                                                            point.position.lng,
                                                        ),
                                                    ] as [number, number],
                                            );

                                        // Get planned waypoints - normalize and filter to survey-only
                                        const allWaypoints =
                                            selectedMission.flight_path
                                                ?.waypoints || [];

                                        // Find survey start index (first non-fly waypoint)
                                        let surveyStartIndex = 0;
                                        for (
                                            let i = 0;
                                            i < allWaypoints.length;
                                            i++
                                        ) {
                                            if (
                                                allWaypoints[i].action !== "fly"
                                            ) {
                                                surveyStartIndex = i;
                                                break;
                                            }
                                        }

                                        // Only show survey waypoints on the map (exclude travel path)
                                        const plannedWaypoints: [
                                            number,
                                            number,
                                        ][] = allWaypoints
                                            .slice(surveyStartIndex)
                                            .map(
                                                (wp: any) =>
                                                    [
                                                        wp.lat,
                                                        normalizeLongitude(
                                                            wp.lng,
                                                        ),
                                                    ] as [number, number],
                                            );

                                        const mapCenter: [number, number] =
                                            flightPath.length > 0
                                                ? flightPath[0]
                                                : coveragePolygon.length > 0
                                                  ? coveragePolygon[0]
                                                  : plannedWaypoints.length > 0
                                                    ? plannedWaypoints[0]
                                                    : [37.7749, -122.4194];

                                        return (
                                            <MapContainer
                                                center={mapCenter}
                                                zoom={15}
                                                style={{
                                                    height: "100%",
                                                    width: "100%",
                                                }}
                                            >
                                                <TileLayer
                                                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png?app=MyReactAppName&contact=prateek0426@gmail.com"
                                                    attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
                                                    keepBuffer={2}
                                                    updateWhenIdle={true}
                                                />

                                                {/* Coverage Area Polygon */}
                                                {coveragePolygon.length > 0 && (
                                                    <Polygon
                                                        positions={
                                                            coveragePolygon
                                                        }
                                                        pathOptions={{
                                                            color: "#3b82f6",
                                                            fillColor:
                                                                "#3b82f6",
                                                            fillOpacity: 0.1,
                                                            weight: 2,
                                                            opacity: 0.6,
                                                        }}
                                                    />
                                                )}

                                                {/* Planned Flight Path */}
                                                {plannedWaypoints.length >
                                                    0 && (
                                                    <Polyline
                                                        positions={
                                                            plannedWaypoints
                                                        }
                                                        pathOptions={{
                                                            color: "#10b981",
                                                            weight: 2,
                                                            opacity: 0.4,
                                                            dashArray: "5, 10",
                                                        }}
                                                    />
                                                )}

                                                {/* Actual Flight Path (from telemetry) */}
                                                {flightPath.length > 0 && (
                                                    <Polyline
                                                        positions={flightPath}
                                                        pathOptions={{
                                                            color: "#ef4444",
                                                            weight: 3,
                                                            opacity: 0.8,
                                                        }}
                                                    />
                                                )}

                                                {/* Start/End Markers */}
                                                {flightPath.length > 0 && (
                                                    <>
                                                        <Marker
                                                            position={
                                                                flightPath[0]
                                                            }
                                                        >
                                                            <Popup>
                                                                <strong>
                                                                    Start
                                                                </strong>
                                                                <br />
                                                                {flightPath[0][0].toFixed(
                                                                    5,
                                                                )}
                                                                ,{" "}
                                                                {flightPath[0][1].toFixed(
                                                                    5,
                                                                )}
                                                            </Popup>
                                                        </Marker>
                                                        {flightPath.length >
                                                            1 && (
                                                            <Marker
                                                                position={
                                                                    flightPath[
                                                                        flightPath.length -
                                                                            1
                                                                    ]
                                                                }
                                                            >
                                                                <Popup>
                                                                    <strong>
                                                                        End
                                                                    </strong>
                                                                    <br />
                                                                    {flightPath[
                                                                        flightPath.length -
                                                                            1
                                                                    ][0].toFixed(
                                                                        5,
                                                                    )}
                                                                    ,{" "}
                                                                    {flightPath[
                                                                        flightPath.length -
                                                                            1
                                                                    ][1].toFixed(
                                                                        5,
                                                                    )}
                                                                </Popup>
                                                            </Marker>
                                                        )}
                                                    </>
                                                )}
                                            </MapContainer>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Flight Path Legend */}
                            <div className="bg-background rounded-lg border p-4">
                                <h4 className="text-sm font-semibold text-foreground mb-3">
                                    Map Legend
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-0.5 bg-blue-500 opacity-60"></div>
                                        <span className="text-sm text-muted-foreground">
                                            Coverage Area (planned)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-8 h-0.5 bg-green-500 opacity-40"
                                            style={{ borderTop: "2px dashed" }}
                                        ></div>
                                        <span className="text-sm text-muted-foreground">
                                            Planned Flight Path
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-1 bg-red-500"></div>
                                        <span className="text-sm text-muted-foreground">
                                            Actual Flight Path (telemetry)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
