import React from 'react';

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

  // Get more specific error messages based on connection state
  const getErrorMessage = () => {
    if (!connectionErrorMessage) return null;

    // Detect common connection issues in the error message
    if (connectionErrorMessage.includes('timeout')) {
      return (
        <>
          <p className='text-muted-foreground mb-2'>
            The server is taking too long to respond.
          </p>
          <p className='text-muted-foreground mb-6'>
            This could be due to server load or network issues.
          </p>
        </>
      );
    } else if (
      connectionErrorMessage.includes('refused') ||
      connectionErrorMessage.includes('unreachable')
    ) {
      return (
        <>
          <p className='text-muted-foreground mb-2'>
            Cannot reach the game server.
          </p>
          <p className='text-muted-foreground mb-6'>
            Please check your internet connection or try again later.
          </p>
        </>
      );
    }

    // Default error message
    return (
      <p className='text-muted-foreground mb-6'>{connectionErrorMessage}</p>
    );
  };

  return (
    <div className='fixed inset-0 bg-background flex flex-col items-center justify-center z-50'>
      {connectionErrorMessage ? (
        <div className='text-center p-6 max-w-md'>
          <div className='text-destructive text-xl font-bold mb-4'>
            Connection Error
          </div>
          {getErrorMessage()}
          <div className='flex flex-col space-y-3'>
            <button
              onClick={() => window.location.reload()}
              className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors'
            >
              Retry Connection
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className='px-4 py-2 bg-transparent border border-muted-foreground text-foreground rounded-md hover:bg-muted/20 transition-colors'
            >
              Back to Lobby
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className='h-12 w-12 mb-4 relative'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-primary'></div>
          </div>
          <h2 className='text-2xl font-bold mb-2'>
            {isConnecting ? 'Connecting...' : 'Loading Game...'}
          </h2>
          <p className='text-muted-foreground text-center max-w-xs px-4'>
            {isConnecting
              ? 'Establishing connection to the game server'
              : 'Preparing your game experience'}
          </p>
          {isConnecting && (
            <p className='text-sm text-muted-foreground mt-8'>
              If this takes longer than expected, check your internet
              connection.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default GameLoader;
