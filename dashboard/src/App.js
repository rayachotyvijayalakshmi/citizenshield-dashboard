import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const SERVER_URL = "http://localhost:3001";

const SEVERITY_CONFIG = {
  CRITICAL: { color: "#FF0000", size: 20 },
  HIGH: { color: "#FF6600", size: 16 },
  MEDIUM: { color: "#FFD700", size: 12 },
  LOW: { color: "#00AA00", size: 8 },
};

export default function PoliceDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/incidents`)
      .then((res) => res.json())
      .then((data) => setIncidents(data))
      .catch((err) => console.error(err));

    socketRef.current = io(SERVER_URL);
    socketRef.current.on("connect", () => setConnected(true));
    socketRef.current.on("disconnect", () => setConnected(false));
    socketRef.current.on("new_incident", (incident) => {
      setIncidents((prev) => [incident, ...prev]);
      playAlert();
    });

    return () => socketRef.current?.disconnect();
  }, []);

  const playAlert = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.5, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + delay + 0.2,
      );
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.2);
    });
  };

  const updateStatus = async (id, status) => {
    await fetch(`${SERVER_URL}/api/incidents/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setIncidents((prev) =>
      prev.map((i) => (i._id === id ? { ...i, status } : i)),
    );
    setSelectedIncident(null);
  };

  // ✅ FIX: Resolved button - reason mandatory
  const handleResolve = async (id) => {
    const reason = window.prompt(
      "Resolution reason select cheyyi (type the number):\n\n" +
        "1. Suspect Arrested\n" +
        "2. Unit Dispatched - Situation Controlled\n" +
        "3. False Alarm\n" +
        "4. Referred to Higher Authority",
    );

    if (!reason) return; // Officer cancel chesthe close avutundi

    await fetch(`${SERVER_URL}/api/incidents/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "RESOLVED",
        resolutionReason: reason,
      }),
    });

    setIncidents((prev) =>
      prev.map((i) => (i._id === id ? { ...i, status: "RESOLVED" } : i)),
    );
    setSelectedIncident(null);
  };

  const AP_CENTER = [15.9129, 79.74];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#040d1a",
        color: "#c8e6f5",
        fontFamily: "Arial",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#0d1f3c",
          padding: "16px 24px",
          borderBottom: "1px solid #1e3a5f",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              color: "#00d4ff",
              margin: 0,
              fontSize: "1.5rem",
              letterSpacing: "3px",
            }}
          >
            🛡️ CITIZENSHIELD
          </h1>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#4a7a99" }}>
            Andhra Pradesh Police — Real-time Crime Monitoring
          </p>
        </div>
        <div
          style={{
            padding: "6px 14px",
            background: connected ? "rgba(0,255,136,0.1)" : "rgba(255,0,0,0.1)",
            border: `1px solid ${connected ? "#00ff88" : "#ff0000"}`,
            borderRadius: "20px",
            fontSize: "0.8rem",
            color: connected ? "#00ff88" : "#ff4444",
          }}
        >
          {connected ? "🟢 LIVE" : "🔴 OFFLINE"}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "16px",
          padding: "16px 24px",
          background: "#0d1f3c",
        }}
      >
        {[
          { label: "Total Reports", value: incidents.length, color: "#00d4ff" },
          {
            label: "Critical",
            value: incidents.filter((i) => i.severity === "CRITICAL").length,
            color: "#ff2244",
          },
          {
            label: "Resolved",
            value: incidents.filter((i) => i.status === "RESOLVED").length,
            color: "#00ff88",
          },
          {
            label: "Pending",
            value: incidents.filter((i) => i.status !== "RESOLVED").length,
            color: "#ffd700",
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "#1a2744",
              padding: "16px",
              borderRadius: "6px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: s.color }}
            >
              {s.value}
            </div>
            <div
              style={{ fontSize: "0.7rem", color: "#4a7a99", marginTop: "4px" }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          height: "calc(100vh - 160px)",
        }}
      >
        {/* Incidents List */}
        <div
          style={{
            overflowY: "auto",
            padding: "16px",
            borderRight: "1px solid #1e3a5f",
          }}
        >
          <h3 style={{ color: "#00d4ff", marginBottom: "16px" }}>
            📋 Live Incidents
          </h3>
          {incidents.length === 0 && (
            <p style={{ color: "#4a7a99", textAlign: "center" }}>
              No incidents yet. Monitoring...
            </p>
          )}
          {incidents.map((inc, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedIncident(inc)}
              style={{
                padding: "12px",
                marginBottom: "10px",
                borderRadius: "6px",
                // ✅ FIX: Resolved incidents grey gaa show avutaayi
                background: inc.status === "RESOLVED" ? "#0f1a2e" : "#1a2744",
                cursor: "pointer",
                borderLeft: `4px solid ${
                  inc.status === "RESOLVED"
                    ? "#2a4a2a"
                    : SEVERITY_CONFIG[inc.severity]?.color || "#888"
                }`,
                opacity: inc.status === "RESOLVED" ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                  {inc.crimeType || inc.aiAnalysis?.crimeType}
                </span>
                <span style={{ fontSize: "0.65rem", color: "#4a7a99" }}>
                  {new Date(inc.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#8899aa",
                  margin: "0 0 6px",
                }}
              >
                {inc.summary || inc.aiAnalysis?.summary}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.68rem",
                }}
              >
                <span style={{ color: "#00d4ff" }}>
                  📍{" "}
                  {inc.location?.description ||
                    inc.aiAnalysis?.locationDescription}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "0.6rem",
                    background:
                      inc.status === "RESOLVED"
                        ? "rgba(0,255,136,0.15)"
                        : "rgba(255,34,68,0.15)",
                    color: inc.status === "RESOLVED" ? "#00ff88" : "#ff4444",
                  }}
                >
                  {inc.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div style={{ padding: "16px" }}>
          <MapContainer
            center={AP_CENTER}
            zoom={7}
            style={{ height: "100%", borderRadius: "8px" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {incidents.map((inc, idx) => {
              // ✅ FIX: Resolved incidents map lo show avvadam ledu
              if (inc.status === "RESOLVED") return null;

              const lat =
                inc.lat ||
                inc.location?.lat ||
                inc.location?.coordinates?.[1] ||
                null;
              const lng =
                inc.lng ||
                inc.location?.lng ||
                inc.location?.coordinates?.[0] ||
                null;
              if (!lat || !lng) return null;
              const cfg =
                SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.MEDIUM;
              return (
                <CircleMarker
                  key={idx}
                  center={[lat, lng]}
                  radius={cfg.size}
                  fillColor={cfg.color}
                  color={cfg.color}
                  fillOpacity={0.7}
                  eventHandlers={{ click: () => setSelectedIncident(inc) }}
                >
                  <Popup>
                    <strong>
                      {inc.crimeType || inc.aiAnalysis?.crimeType}
                    </strong>
                    <br />
                    {inc.summary || inc.aiAnalysis?.summary}
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Modal */}
      {selectedIncident && (
        <div
          onClick={() => setSelectedIncident(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0d1f3c",
              borderRadius: "12px",
              width: "500px",
              maxHeight: "80vh",
              overflowY: "auto",
              border: "1px solid #1e3a5f",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <h2 style={{ color: "#00d4ff", margin: 0 }}>
                🚨 Incident Details
              </h2>
              <button
                onClick={() => setSelectedIncident(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "white",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
            {[
              [
                "Crime Type",
                selectedIncident.crimeType ||
                  selectedIncident.aiAnalysis?.crimeType,
              ],
              ["Severity", selectedIncident.severity],
              [
                "Summary",
                selectedIncident.summary ||
                  selectedIncident.aiAnalysis?.summary,
              ],
              [
                "Telugu Summary",
                selectedIncident.teluguSummary ||
                  selectedIncident.aiAnalysis?.teluguSummary,
              ],
              [
                "Location",
                selectedIncident.location?.description ||
                  selectedIncident.aiAnalysis?.locationDescription,
              ],
              [
                "Suggested Action",
                selectedIncident.suggestedAction ||
                  selectedIncident.aiAnalysis?.suggestedAction,
              ],
              ["Status", selectedIncident.status],
              ["Time", new Date(selectedIncident.timestamp).toLocaleString()],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  gap: "16px",
                  padding: "8px 0",
                  borderBottom: "1px solid #1e3a5f",
                  fontSize: "0.82rem",
                }}
              >
                <span
                  style={{ width: "130px", color: "#4a7a99", flexShrink: 0 }}
                >
                  {k}
                </span>
                <span>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button
                onClick={() =>
                  updateStatus(selectedIncident._id, "ACKNOWLEDGED")
                }
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.75rem",
                  background: "#1a3a5c",
                }}
              >
                ✅ Acknowledge
              </button>
              <button
                onClick={() => updateStatus(selectedIncident._id, "DISPATCHED")}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.75rem",
                  background: "#5c4a1a",
                }}
              >
                🚔 Dispatch
              </button>
              {/* ✅ FIX: Resolved button - reason mandatory */}
              <button
                onClick={() => handleResolve(selectedIncident._id)}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.75rem",
                  background: "#1a5c2a",
                }}
              >
                ✔️ Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
