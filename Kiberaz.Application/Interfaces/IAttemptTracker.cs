namespace Kiberaz.Application.Interfaces;

public interface IAttemptTracker
{
    bool RequiresCaptcha(string key);
    void Record(string key);
    void Reset(string key);
}
