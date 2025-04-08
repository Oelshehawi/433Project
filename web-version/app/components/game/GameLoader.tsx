import React from "react";

interface GameLoaderProps {
  isConnecting: boolean;
  isLoading: boolean;
  connectionErrorMessage?: string;
}

const GameLoader: React.FC<GameLoaderProps> = ({
  isConnecting,
  isLoading,
  connectionErrorMessage,
}) => {
  if (!isConnecting && !isLoading && !connectionErrorMessage) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      {connectionErrorMessage ? (
        <div className="text-center p-6 max-w-md">
          <div className="text-destructive text-xl font-bold mb-4">
            Connection Error
          </div>
          <p className="text-muted-foreground mb-6">{connectionErrorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <>
          <div className="h-12 w-12 mb-4 relative">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-primary"></div>
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {isConnecting ? "Connecting..." : "Loading Game..."}
          </h2>
          <p className="text-muted-foreground text-center max-w-xs px-4">
            {isConnecting
              ? "Establishing connection to the game server"
              : "Preparing your game experience"}
          </p>
        </>
      )}
    </div>
  );
};

export default GameLoader;
