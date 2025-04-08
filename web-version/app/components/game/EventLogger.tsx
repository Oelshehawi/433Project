import React from "react";

interface EventLoggerProps {
  eventLogs: string[];
  onClearLogs: () => void;
}

const EventLogger: React.FC<EventLoggerProps> = ({
  eventLogs,
  onClearLogs,
}) => {
  return (
    <div className="absolute top-16 left-0 right-0 text-center">
      <div className="bg-gray-900/70 text-white px-4 py-2 rounded-md inline-block max-w-[600px] w-full mx-auto">
        <div className="text-sm font-mono text-left max-h-[180px] overflow-y-auto">
          <div className="text-xs text-gray-400 mb-1 border-b border-gray-700 pb-1 flex justify-between items-center">
            <span>Debug Logs</span>
            <button
              onClick={onClearLogs}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          {eventLogs.map((log, index) => {
            // Extract source from log if possible
            const sourceMatch = log.match(/\[(.*?)\]/);
            const source = sourceMatch ? sourceMatch[1] : "UI";

            // Determine color based on source
            let textColor = "text-white";
            if (source === "GameState") textColor = "text-green-400";
            if (source === "GestureDetector") textColor = "text-blue-400";
            if (source === "WebSocket") textColor = "text-purple-400";
            if (source === "Animation") textColor = "text-yellow-400";

            return (
              <div
                key={index}
                className={`whitespace-nowrap ${textColor} text-xs`}
              >
                {log}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EventLogger;
