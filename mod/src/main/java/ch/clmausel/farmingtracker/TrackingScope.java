package ch.clmausel.farmingtracker;

final class TrackingScope {
    private TrackingScope() {}
    static boolean multiplayer(boolean integratedServer, boolean remoteServer) {
        return !integratedServer && remoteServer;
    }
    static boolean uploadServer(String server) {
        return server != null && !server.isBlank() && !"singleplayer".equals(server);
    }
}
