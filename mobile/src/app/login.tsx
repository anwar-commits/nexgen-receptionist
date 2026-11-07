import { Redirect } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, colors, ErrorText, Loading, styles } from "../components/ui";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (user) return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 20 }}>
        <Card style={{ gap: 16, padding: 24 }}>
          <View style={styles.row}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20 }}>N</Text>
            </View>
            <View>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.ink }}>NexGen Receptionist</Text>
              <Text style={styles.muted}>Sign in to see calls and leads</Text>
            </View>
          </View>
          <ErrorText error={error} />
          <View style={{ gap: 6 }}>
            <Text nativeID="emailLabel" style={{ fontWeight: "600" }}>
              Email
            </Text>
            <TextInput
              accessibilityLabelledBy="emailLabel"
              style={styles.input}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text nativeID="passwordLabel" style={{ fontWeight: "600" }}>
              Password
            </Text>
            <TextInput
              accessibilityLabelledBy="passwordLabel"
              style={styles.input}
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
            />
          </View>
          <Button title={busy ? "Signing in…" : "Sign in"} variant="primary" onPress={submit} disabled={busy || !email || !password} />
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
