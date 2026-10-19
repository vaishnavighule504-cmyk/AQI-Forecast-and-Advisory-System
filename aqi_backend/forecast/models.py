from django.db import models

class AQIReading(models.Model):
    city = models.CharField(max_length=50, db_index=True)
    date = models.DateField(db_index=True)
    aqi = models.IntegerField()
    pm25 = models.FloatField(null=True, blank=True)
    pm10 = models.FloatField(null=True, blank=True)
    no2 = models.FloatField(null=True, blank=True)
    so2 = models.FloatField(null=True, blank=True)
    co = models.FloatField(null=True, blank=True)
    o3 = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ('city', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.city} - {self.date}: {self.aqi}"

class LiveAQIReading(models.Model):
    city = models.CharField(max_length=50, db_index=True)
    timestamp = models.DateTimeField(db_index=True)
    aqi = models.IntegerField()
    pm25 = models.FloatField(null=True, blank=True)
    pm10 = models.FloatField(null=True, blank=True)
    no2 = models.FloatField(null=True, blank=True)
    so2 = models.FloatField(null=True, blank=True)
    co = models.FloatField(null=True, blank=True)
    o3 = models.FloatField(null=True, blank=True)
    nh3 = models.FloatField(null=True, blank=True)
    is_live = models.BooleanField(default=True)
    derived_method = models.CharField(max_length=300)
    station_data = models.JSONField(null=True, blank=True)  # Store JSON details of raw station readings

    class Meta:
        unique_together = ('city', 'timestamp')
        ordering = ['-timestamp']

    def __str__(self):
        return f"Live {self.city} - {self.timestamp}: {self.aqi}"

