export class User {
  static async me() {
    // No user is authenticated by default
    return null;
  }

  static async loginWithRedirect(_redirectUrl: string) {
    // Simulate login by reloading the page
    window.location.reload();
  }
} 