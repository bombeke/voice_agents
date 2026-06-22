{pkgs}: {
  deps = [
    pkgs.dbus
    pkgs.nss
    pkgs.nspr
    pkgs.gradle
    pkgs.android-tools
    pkgs.jdk17
    pkgs.glib
  ];
}
